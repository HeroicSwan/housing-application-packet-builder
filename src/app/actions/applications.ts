"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { canAccessCase, requireRole } from "@/lib/auth/session";
import { calculateDraftReadiness } from "@/lib/applications/mapping";
import { createOrRefreshDraft, updateDraftReadiness } from "@/lib/applications/service";
import { headers } from "next/headers";
import { sha256 } from "@/lib/security/encryption";
import { deliverApplication } from "@/lib/submissions";

export async function openApplicationDraftAction(clientCaseId: string, templateId: string) {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const draft = await createOrRefreshDraft(clientCaseId, templateId, user.id);
  await recordAudit({ userId: user.id, clientCaseId, action: "APPLICATION_DRAFT_OPENED", entityType: "ApplicationDraft", entityId: draft.id, metadata: "Application draft mapped from reviewed canonical information" });
  redirect(`/applications/${draft.id}`);
}

export async function refreshApplicationDraftAction(draftId: string) {
  const user = await requireRole(["CASEWORKER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Case access denied.");
  await createOrRefreshDraft(draft.clientCaseId, draft.templateId, user.id);
  revalidatePath(`/applications/${draftId}`);
}

export async function answerApplicationFieldAction(draftId: string, fieldId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  const field = await db.applicationDraftField.findUniqueOrThrow({ where: { id: fieldId }, include: { draft: true, templateField: true } });
  if (field.draftId !== draftId || !(await canAccessCase(user, field.draft.clientCaseId))) throw new Error("Draft access denied.");
  const raw = field.templateField.fieldType === "BOOLEAN" ? String(formData.get("value") === "on" || formData.get("value") === "Yes") : z.string().trim().max(2000).parse(String(formData.get("value") ?? ""));
  const value = field.templateField.fieldType === "BOOLEAN" ? (raw === "true" ? "Yes" : "No") : raw;
  if (field.templateField.required && !value) throw new Error("This answer is required.");
  await db.applicationDraftField.update({ where: { id: fieldId }, data: { finalValue: value, proposedValue: value, populationMethod: "STAFF_ENTRY", sourceType: "STAFF", sourceReference: `Confirmed by ${user.name}`, reviewState: "CONFIRMED", validationState: "VALID", answeredById: user.id, answeredAt: new Date(), staffNote: z.string().trim().max(500).parse(String(formData.get("note") ?? "")) || null } });
  await updateDraftReadiness(draftId);
  await recordAudit({ userId: user.id, clientCaseId: field.draft.clientCaseId, action: "APPLICATION_FIELD_ANSWERED", entityType: "ApplicationDraftField", entityId: field.id, metadata: `${field.templateField.displayLabel} confirmed by staff` });
  revalidatePath(`/applications/${draftId}`);
  revalidatePath(`/applications/${draftId}/questions`);
}

export async function generateApplicationAction(draftId: string) {
  const user = await requireRole(["CASEWORKER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId }, include: { clientCase: true, fields: { include: { templateField: true } } } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  if (!(await db.applicationSignature.count({ where: { draftId } }))) redirect(`/applications/${draftId}/preview?error=${encodeURIComponent("Capture the applicant's electronic signature and consent before generation.")}`);
  const readiness = calculateDraftReadiness(draft.fields.map((field) => ({ required: field.templateField.required, fieldType: field.templateField.fieldType, finalValue: field.finalValue, reviewState: field.reviewState, validationState: field.validationState })));
  if (!readiness.ready) redirect(`/applications/${draftId}?error=${encodeURIComponent(`${readiness.blockingCount} required application field${readiness.blockingCount === 1 ? " is" : "s are"} unresolved.`)}`);
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "GENERATED", generatedAt: new Date(), generationVersion: { increment: 1 } } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "COMPLETED_APPLICATION_GENERATED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Template-backed housing application generated" });
  redirect(`/applications/${draftId}/preview?generated=1`);
}

export async function captureElectronicSignatureAction(draftId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const signedName = z.string().trim().min(2).max(160).parse(formData.get("signedName"));
  const signerEmail = z.string().email().or(z.literal("")).parse(String(formData.get("signerEmail") ?? "")) || null;
  if (formData.get("attestation") !== "on" || formData.get("documentConsent") !== "on") throw new Error("The applicant must accept both statements before signing.");
  const requestHeaders = await headers(); const address = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim(); const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.applicationSignature.upsert({ where: { draftId }, create: { draftId, signedName, signerEmail, attestationVersion: "application-certification-v1", capturedById: user.id, signerIpHash: address ? sha256(address) : null }, update: { signedName, signerEmail, attestationVersion: "application-certification-v1", signedAt: now, capturedById: user.id, signerIpHash: address ? sha256(address) : null } });
    await tx.consentRecord.create({ data: { clientCaseId: draft.clientCaseId, draftId, consentType: "DOCUMENT_RELEASE", version: "document-release-v1", granted: true, grantedAt: now, recordedById: user.id, evidenceNote: "Applicant accepted electronic document release during signature capture." } });
    await tx.clientCase.update({ where: { id: draft.clientCaseId }, data: { consentConfirmedAt: now } });
    await tx.applicationDraftField.updateMany({ where: { draftId, templateField: { canonicalFieldPath: "consentConfirmed" } }, data: { finalValue: "Yes", proposedValue: "Yes", populationMethod: "APPLICANT_CONFIRMATION", sourceType: "ELECTRONIC_CONSENT", sourceReference: "Electronic signature and document-release consent", reviewState: "CONFIRMED", validationState: "VALID", answeredById: user.id, answeredAt: now } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_ELECTRONICALLY_SIGNED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Typed signature and document-release consent captured; signature value not logged" } });
  });
  await updateDraftReadiness(draftId);
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath(`/applications/${draftId}`);
}

export async function toggleDraftDocumentAction(draftId: string, documentId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  const item = await db.applicationDraftDocument.findUniqueOrThrow({ where: { draftId_uploadedDocumentId: { draftId, uploadedDocumentId: documentId } }, include: { draft: true } });
  if (!(await canAccessCase(user, item.draft.clientCaseId))) throw new Error("Draft access denied.");
  await db.applicationDraftDocument.update({ where: { id: item.id }, data: { selected: formData.get("selected") === "on" } });
  revalidatePath(`/applications/${draftId}/preview`);
}

export async function updateDraftDocumentsAction(draftId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const selected = new Set(formData.getAll("selectedDocument").map(String));
  const items = await db.applicationDraftDocument.findMany({ where: { draftId }, include: { uploadedDocument: { include: { extractedFields: true } } } });
  for (const item of items) {
    const eligible = item.authorized && item.uploadedDocument.processingStatus === "COMPLETED" && !item.uploadedDocument.extractedFields.some((field) => field.reviewStatus === "REJECTED");
    await db.applicationDraftDocument.update({ where: { id: item.id }, data: { selected: eligible && selected.has(item.uploadedDocumentId) } });
  }
  revalidatePath(`/applications/${draftId}/preview`);
}

export async function submitApplicationForReviewAction(draftId: string) {
  const user = await requireRole(["CASEWORKER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  if (draft.status !== "GENERATED") throw new Error("Generate the completed application before submitting it for review.");
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "SUBMITTED_FOR_REVIEW" } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_SUBMITTED_FOR_REVIEW", entityType: "ApplicationDraft", entityId: draftId, metadata: "Completed application and selected supporting documents submitted for review" });
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath("/review");
}

export async function approveApplicationDraftAction(draftId: string) {
  const user = await requireRole(["REVIEWER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (draft.status !== "SUBMITTED_FOR_REVIEW") throw new Error("Only submitted applications can be approved.");
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "APPROVED" } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_APPROVED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Completed application and supporting packet approved by reviewer" });
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath("/review");
}

export async function returnApplicationDraftAction(draftId: string, formData: FormData) {
  const user = await requireRole(["REVIEWER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (draft.status !== "SUBMITTED_FOR_REVIEW") throw new Error("Only submitted applications can be returned.");
  const note = z.string().trim().min(3).max(500).parse(String(formData.get("note") ?? ""));
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "RETURNED" } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_RETURNED", entityType: "ApplicationDraft", entityId: draftId, metadata: note });
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath("/review");
}

export async function deliverApprovedApplicationAction(draftId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const destinationId = z.string().cuid().parse(formData.get("destinationId"));
  const result = await deliverApplication(draftId, destinationId);
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: result.status === "SUBMITTED" ? "APPLICATION_DELIVERED" : "APPLICATION_DELIVERY_FAILED", entityType: "ApplicationSubmission", entityId: result.id, metadata: `Delivery status ${result.status}; destination ${destinationId}` });
  revalidatePath(`/applications/${draftId}/preview`);
}
