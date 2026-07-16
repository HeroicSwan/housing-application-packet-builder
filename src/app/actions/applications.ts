"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { calculateDraftReadiness } from "@/lib/applications/mapping";
import { createOrRefreshDraft, updateDraftReadiness } from "@/lib/applications/service";
import { headers } from "next/headers";
import { sha256 } from "@/lib/security/encryption";
import { enqueueBackgroundJob, runNextOrganizationJob } from "@/lib/jobs";
import { env } from "@/lib/env";
import { computeDraftContentDigest, invalidateDraftIntegrity } from "@/lib/applications/integrity";
import { runWithOrganization } from "@/lib/tenant-context";
import { generateApplicationOutput } from "@/lib/applications/output";

export async function openApplicationDraftAction(clientCaseId: string, templateId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const draft = await createOrRefreshDraft(clientCaseId, templateId, user.id);
  await recordAudit({ userId: user.id, clientCaseId, action: "APPLICATION_DRAFT_OPENED", entityType: "ApplicationDraft", entityId: draft.id, metadata: "Application draft mapped from reviewed canonical information" });
  redirect(`/applications/${draft.id}`);
}

export async function refreshApplicationDraftAction(draftId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Case access denied.");
  await createOrRefreshDraft(draft.clientCaseId, draft.templateId, user.id);
  await runWithOrganization(user.organizationId, () => invalidateDraftIntegrity(draftId, user.id, "The application was refreshed from updated case sources."));
  activateOrganizationContext(user);
  revalidatePath(`/applications/${draftId}`);
}

export async function answerApplicationFieldAction(draftId: string, fieldId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const field = await db.applicationDraftField.findUniqueOrThrow({ where: { id: fieldId }, include: { draft: true, templateField: true } });
  if (field.draftId !== draftId || !(await canAccessCase(user, field.draft.clientCaseId))) throw new Error("Draft access denied.");
  const raw = field.templateField.fieldType === "BOOLEAN" ? String(formData.get("value") === "on" || formData.get("value") === "Yes") : z.string().trim().max(2000).parse(String(formData.get("value") ?? ""));
  const value = field.templateField.fieldType === "BOOLEAN" ? (raw === "true" ? "Yes" : "No") : raw;
  if (field.templateField.required && !value) throw new Error("This answer is required.");
  await db.applicationDraftField.update({ where: { id: fieldId }, data: { finalValue: value, proposedValue: value, populationMethod: "STAFF_ENTRY", sourceType: "STAFF", sourceReference: `Confirmed by ${user.name}`, reviewState: "CONFIRMED", validationState: "VALID", answeredById: user.id, answeredAt: new Date(), staffNote: z.string().trim().max(500).parse(String(formData.get("note") ?? "")) || null } });
  await runWithOrganization(user.organizationId, () => invalidateDraftIntegrity(draftId, user.id, "An application answer changed."));
  activateOrganizationContext(user);
  await updateDraftReadiness(draftId);
  await recordAudit({ userId: user.id, clientCaseId: field.draft.clientCaseId, action: "APPLICATION_FIELD_ANSWERED", entityType: "ApplicationDraftField", entityId: field.id, metadata: `${field.templateField.displayLabel} confirmed by staff` });
  revalidatePath(`/applications/${draftId}`);
  revalidatePath(`/applications/${draftId}/questions`);
}

export async function generateApplicationAction(draftId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId }, include: { clientCase: true, fields: { include: { templateField: true } } } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const signature = await db.applicationSignature.findUnique({ where: { draftId } });
  if (!signature || signature.invalidatedAt) redirect(`/applications/${draftId}/preview?error=${encodeURIComponent("Capture the applicant's current electronic signature and consent before generation.")}`);
  const contentDigest = await computeDraftContentDigest(draftId);
  if (signature.signedContentDigest !== contentDigest) redirect(`/applications/${draftId}/preview?error=${encodeURIComponent("Application data changed after signing. Capture a new signature before generation.")}`);
  const readiness = calculateDraftReadiness(draft.fields.map((field) => ({ required: field.templateField.required, fieldType: field.templateField.fieldType, finalValue: field.finalValue, reviewState: field.reviewState, validationState: field.validationState })));
  if (!readiness.ready) redirect(`/applications/${draftId}?error=${encodeURIComponent(`${readiness.blockingCount} required application field${readiness.blockingCount === 1 ? " is" : "s are"} unresolved.`)}`);
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "GENERATED", generatedAt: new Date(), generationVersion: { increment: 1 }, contentDigest, approvalInvalidatedAt: null, approvalInvalidationReason: null } });
  const output = await generateApplicationOutput(draftId);
  await db.applicationSignature.update({ where: { draftId }, data: { finalDocumentHash: sha256(output.bytes) } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "COMPLETED_APPLICATION_GENERATED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Template-backed housing application generated" });
  redirect(`/applications/${draftId}/preview?generated=1`);
}

export async function captureElectronicSignatureAction(draftId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId }, include: { clientCase: { include: { organization: true } } } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const signedName = z.string().trim().min(2).max(160).parse(formData.get("signedName"));
  const signerEmail = z.string().email().or(z.literal("")).parse(String(formData.get("signerEmail") ?? "")) || null;
  if (formData.get("attestation") !== "on" || formData.get("documentConsent") !== "on") throw new Error("The applicant must accept both statements before signing.");
  const organization = draft.clientCase.organization;
  if (!organization) throw new Error("An organization signature policy is required.");
  const contentDigest = await computeDraftContentDigest(draftId);
  const requestHeaders = await headers(); const address = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim(); const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.applicationSignature.upsert({ where: { draftId }, create: { draftId, signedName, signerEmail, signatureMethod: organization.signaturePolicy === "TYPED_OR_DRAWN" ? "TYPED" : organization.signaturePolicy, attestationVersion: "application-certification-v1", consentVersion: organization.consentVersion, intentConfirmed: true, disclosureAccepted: true, signedContentDigest: contentDigest, legalDisclaimerVersion: organization.consentVersion, capturedById: user.id, signerIpHash: address ? sha256(address) : null }, update: { signedName, signerEmail, signatureMethod: organization.signaturePolicy === "TYPED_OR_DRAWN" ? "TYPED" : organization.signaturePolicy, attestationVersion: "application-certification-v1", consentVersion: organization.consentVersion, intentConfirmed: true, disclosureAccepted: true, signedContentDigest: contentDigest, invalidatedAt: null, invalidationReason: null, finalDocumentHash: null, legalDisclaimerVersion: organization.consentVersion, signedAt: now, capturedById: user.id, signerIpHash: address ? sha256(address) : null } });
    await tx.consentRecord.create({ data: { clientCaseId: draft.clientCaseId, draftId, consentType: "DOCUMENT_RELEASE", version: organization.consentVersion, granted: true, grantedAt: now, recordedById: user.id, evidenceNote: "Applicant accepted the configured document-release disclosure and intent-to-sign acknowledgement." } });
    await tx.clientCase.update({ where: { id: draft.clientCaseId }, data: { consentConfirmedAt: now } });
    await tx.applicationDraftField.updateMany({ where: { draftId, templateField: { canonicalFieldPath: "consentConfirmed" } }, data: { finalValue: "Yes", proposedValue: "Yes", populationMethod: "APPLICANT_CONFIRMATION", sourceType: "ELECTRONIC_CONSENT", sourceReference: "Electronic signature and document-release consent", reviewState: "CONFIRMED", validationState: "VALID", answeredById: user.id, answeredAt: now } });
    await tx.applicationDraft.update({ where: { id: draftId }, data: { contentDigest, approvalInvalidatedAt: null, approvalInvalidationReason: null } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_ELECTRONICALLY_SIGNED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Typed signature and document-release consent captured; signature value not logged" } });
  });
  await updateDraftReadiness(draftId);
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath(`/applications/${draftId}`);
}

export async function toggleDraftDocumentAction(draftId: string, documentId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const item = await db.applicationDraftDocument.findUniqueOrThrow({ where: { draftId_uploadedDocumentId: { draftId, uploadedDocumentId: documentId } }, include: { draft: true } });
  if (!(await canAccessCase(user, item.draft.clientCaseId))) throw new Error("Draft access denied.");
  await db.applicationDraftDocument.update({ where: { id: item.id }, data: { selected: formData.get("selected") === "on" } });
  await runWithOrganization(user.organizationId, () => invalidateDraftIntegrity(draftId, user.id, "The supporting-document selection changed."));
  activateOrganizationContext(user);
  revalidatePath(`/applications/${draftId}/preview`);
}

export async function updateDraftDocumentsAction(draftId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const selected = new Set(formData.getAll("selectedDocument").map(String));
  const items = await db.applicationDraftDocument.findMany({ where: { draftId }, include: { uploadedDocument: { include: { extractedFields: true } } } });
  for (const item of items) {
    const eligible = item.authorized && item.uploadedDocument.processingStatus === "COMPLETED" && item.uploadedDocument.quarantineStatus === "CLEAR" && !item.uploadedDocument.deletedAt && !item.uploadedDocument.extractedFields.some((field) => !["APPROVED", "EDITED"].includes(field.reviewStatus));
    await db.applicationDraftDocument.update({ where: { id: item.id }, data: { selected: eligible && selected.has(item.uploadedDocumentId) } });
  }
  await runWithOrganization(user.organizationId, () => invalidateDraftIntegrity(draftId, user.id, "The supporting-document selection changed."));
  activateOrganizationContext(user);
  revalidatePath(`/applications/${draftId}/preview`);
}

export async function submitApplicationForReviewAction(draftId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  if (draft.status !== "GENERATED") throw new Error("Generate the completed application before submitting it for review.");
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "SUBMITTED_FOR_REVIEW", reviewCycle: { increment: 1 } } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_SUBMITTED_FOR_REVIEW", entityType: "ApplicationDraft", entityId: draftId, metadata: "Completed application and selected supporting documents submitted for review" });
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath("/review");
}

export async function approveApplicationDraftAction(draftId: string) {
  const user = activateOrganizationContext(await requireRole(["REVIEWER", "SUPERVISOR"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId }, include: { signature: true } });
  if (draft.status !== "SUBMITTED_FOR_REVIEW") throw new Error("Only submitted applications can be approved.");
  const digest = await computeDraftContentDigest(draftId);
  if (!draft.signature || draft.signature.invalidatedAt || draft.signature.signedContentDigest !== digest || !draft.signature.intentConfirmed || !draft.signature.disclosureAccepted) throw new Error("A current signature and consent matching this exact application are required before approval.");
  const approved = await db.applicationDraft.updateMany({ where: { id: draftId, status: "SUBMITTED_FOR_REVIEW", approvedDigest: null }, data: { status: "APPROVED", approvedDigest: digest, approvedAt: new Date(), approvedById: user.id } });
  if (approved.count !== 1) throw new Error("This application changed while it was being approved. Reload and review it again.");
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_APPROVED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Completed application and supporting packet approved by reviewer" });
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath("/review");
}

export async function returnApplicationDraftAction(draftId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["REVIEWER", "SUPERVISOR"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (draft.status !== "SUBMITTED_FOR_REVIEW") throw new Error("Only submitted applications can be returned.");
  const note = z.string().trim().min(3).max(500).parse(String(formData.get("note") ?? ""));
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: "RETURNED" } });
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_RETURNED", entityType: "ApplicationDraft", entityId: draftId, metadata: note });
  revalidatePath(`/applications/${draftId}/preview`); revalidatePath("/review");
}

export async function deliverApprovedApplicationAction(draftId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (!(await canAccessCase(user, draft.clientCaseId))) throw new Error("Draft access denied.");
  const destinationId = z.string().cuid().parse(formData.get("destinationId"));
  await enqueueBackgroundJob("DELIVER_APPLICATION", { draftId, destinationId, userId: user.id, clientCaseId: draft.clientCaseId }, `delivery:${draftId}:${destinationId}:${draft.generationVersion}`);
  await recordAudit({ userId: user.id, clientCaseId: draft.clientCaseId, action: "APPLICATION_DELIVERY_QUEUED", entityType: "ApplicationDraft", entityId: draftId, metadata: `Durable delivery queued for destination ${destinationId}` });
  if (!env.ENFORCE_PRODUCTION_CONFIG) await runNextOrganizationJob("local-inline-worker");
  revalidatePath(`/applications/${draftId}/preview`);
}

export async function retryApplicationDeliveryAction(draftId: string, submissionId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const submission = await db.applicationSubmission.findFirstOrThrow({ where: { id: submissionId, draftId }, include: { draft: true } });
  if (!(await canAccessCase(user, submission.draft.clientCaseId))) throw new Error("Draft access denied.");
  if (!submission.deadLetteredAt && submission.status !== "FAILED") throw new Error("Only a failed or dead-letter delivery can be retried manually.");
  if (submission.canceledAt) throw new Error("Canceled deliveries cannot be retried.");
  await db.applicationSubmission.update({ where: { id: submission.id }, data: { status: "PENDING", deadLetteredAt: null, nextAttemptAt: new Date(), errorMessage: null } });
  await enqueueBackgroundJob("DELIVER_APPLICATION", { draftId, destinationId: submission.destinationId, userId: user.id, clientCaseId: submission.draft.clientCaseId }, `delivery:${draftId}:${submission.destinationId}:${submission.generationVersion}:manual:${Date.now()}`);
  await recordAudit({ userId: user.id, clientCaseId: submission.draft.clientCaseId, action: "APPLICATION_DELIVERY_RETRIED", entityType: "ApplicationSubmission", entityId: submission.id, metadata: "Manual retry queued after staff review" });
  if (!env.ENFORCE_PRODUCTION_CONFIG) await runNextOrganizationJob("local-inline-worker");
  revalidatePath(`/applications/${draftId}/preview`);
}

export async function cancelApplicationDeliveryAction(draftId: string, submissionId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const submission = await db.applicationSubmission.findFirstOrThrow({ where: { id: submissionId, draftId }, include: { draft: true } });
  if (!(await canAccessCase(user, submission.draft.clientCaseId))) throw new Error("Draft access denied.");
  if (["SUBMITTED", "CANCELED"].includes(submission.status)) throw new Error("This delivery can no longer be canceled safely.");
  const dedupeKey = `delivery:${draftId}:${submission.destinationId}:${submission.generationVersion}`;
  await db.$transaction([
    db.applicationSubmission.update({ where: { id: submission.id }, data: { status: "CANCELED", canceledAt: new Date(), nextAttemptAt: null, errorMessage: null } }),
    db.backgroundJob.updateMany({ where: { dedupeKey, status: { in: ["PENDING", "DEAD_LETTER"] } }, data: { status: "CANCELED", completedAt: new Date() } }),
    db.auditEvent.create({ data: { userId: user.id, clientCaseId: submission.draft.clientCaseId, action: "APPLICATION_DELIVERY_CANCELED", entityType: "ApplicationSubmission", entityId: submission.id, metadata: "Queued delivery canceled before a confirmed submission" } }),
  ]);
  revalidatePath(`/applications/${draftId}/preview`);
}
