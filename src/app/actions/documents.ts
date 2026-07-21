"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { inspectDocumentSafety, sanitizeFilename, validateFileSignature, validateUpload } from "@/lib/validation/files";
import { deleteObject, putObject } from "@/lib/storage";
import { MalwareDetectedError, scanForMalware } from "@/lib/security/malware";
import { sha256 } from "@/lib/security/encryption";
import { enqueueBackgroundJob, runNextOrganizationJob } from "@/lib/jobs";
import { invalidateCaseDrafts } from "@/lib/applications/integrity";
import { runWithOrganization } from "@/lib/tenant-context";

const categorySchema = z.enum(["IDENTITY", "INCOME", "RESIDENCY", "HOUSEHOLD", "DISABILITY", "HOMELESSNESS_VERIFICATION", "OTHER"]);
const reviewStatuses = ["APPROVED", "EDITED", "REJECTED", "UNREADABLE", "MISSING", "EXPIRED", "INVALID", "CONFLICTING"] as const;
const reviewSchema = z.object({ status: z.enum(reviewStatuses), reviewedValue: z.string().trim().max(500), reason: z.string().trim().max(1000) });
const validationStateByReview = { APPROVED: "VALID", EDITED: "CORRECTED", REJECTED: "INVALID", UNREADABLE: "UNREADABLE_SCAN", MISSING: "MISSING_VALUE", EXPIRED: "EXPIRED_DOCUMENT", INVALID: "INVALID_FORMAT", CONFLICTING: "CONFLICTING_VALUE" } as const;

export type UploadFormState = { message: string; error: boolean };

export async function uploadDocumentAction(clientCaseId: string, _previousState: UploadFormState, formData: FormData): Promise<UploadFormState> {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose a document to upload.", error: true };
  const validation = validateUpload(file, env.MAX_UPLOAD_MB);
  if (!validation.valid) return { message: validation.error, error: true };
  const parsedCategory = categorySchema.safeParse(formData.get("category"));
  if (!parsedCategory.success) return { message: "Choose a valid document category.", error: true };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateFileSignature(bytes, file.type)) return { message: "The file contents do not match the selected PDF or image type.", error: true };
  try { await inspectDocumentSafety(bytes, file.type); } catch (error) { return { message: error instanceof Error ? error.message : "The document could not be safely inspected.", error: true }; }

  const checksum = sha256(bytes);
  const duplicate = await db.uploadedDocument.findFirst({ where: { clientCaseId, checksumSha256: checksum, deletedAt: null }, select: { id: true, originalFilename: true } });
  const safeName = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  if (duplicate) {
    const attempt = await db.uploadedDocument.create({ data: { clientCaseId, originalFilename: file.name, safeFilename: safeName, fileType: file.type, checksumSha256: checksum, sizeBytes: file.size, documentCategory: parsedCategory.data, processingStatus: "DUPLICATE", quarantineStatus: "CLEAR", duplicateOfId: duplicate.id, processingError: "An identical document already exists in this case.", uploadedById: user.id } });
    await db.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "DOCUMENT_DUPLICATE_DETECTED", entityType: "UploadedDocument", entityId: attempt.id, metadata: `Duplicate of document ${duplicate.id}; filenames and document content not logged` } });
    revalidatePath(`/cases/${clientCaseId}/documents`);
    return { message: "An identical document is already attached to this case. The duplicate attempt was recorded but not stored again.", error: true };
  }

  try {
    await scanForMalware(bytes);
  } catch (error) {
    if (!(error instanceof MalwareDetectedError)) return { message: error instanceof Error ? error.message : "Malware scanning did not complete.", error: true };
    const stored = await putObject(`quarantine/${clientCaseId}/${safeName}`, bytes, file.type);
    const quarantined = await db.uploadedDocument.create({ data: { clientCaseId, originalFilename: file.name, safeFilename: safeName, fileType: file.type, storageKey: stored.key, storageProvider: stored.provider, checksumSha256: stored.checksum, sizeBytes: stored.size, documentCategory: parsedCategory.data, processingStatus: "QUARANTINED", quarantineStatus: "QUARANTINED", quarantineReasonCode: error.code, processingError: "The document is quarantined and cannot be opened or processed.", uploadedById: user.id } });
    await db.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "DOCUMENT_QUARANTINED", entityType: "UploadedDocument", entityId: quarantined.id, metadata: "Malware detection quarantined encrypted bytes; content and filename not logged" } });
    revalidatePath(`/cases/${clientCaseId}/documents`);
    return { message: "The upload was quarantined after malware detection. It cannot be opened or processed.", error: true };
  }

  const stored = await putObject(`documents/${clientCaseId}/${safeName}`, bytes, file.type);
  const document = await db.$transaction(async (tx) => {
    const created = await tx.uploadedDocument.create({ data: { clientCaseId, originalFilename: file.name, safeFilename: safeName, fileType: file.type, storageKey: stored.key, storageProvider: stored.provider, checksumSha256: stored.checksum, sizeBytes: stored.size, documentCategory: parsedCategory.data, processingStatus: "PROCESSING", uploadedById: user.id } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "DOCUMENT_UPLOADED", entityType: "UploadedDocument", entityId: created.id, metadata: `Document category: ${parsedCategory.data}; content and original filename not logged` } });
    return created;
  });
  await enqueueBackgroundJob("PROCESS_DOCUMENT", { documentId: document.id, userId: user.id }, `document:${document.id}:initial`);
  if (!env.ENFORCE_PRODUCTION_CONFIG) await runNextOrganizationJob("local-inline-worker");
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
  return { message: env.ENFORCE_PRODUCTION_CONFIG ? "Document uploaded and queued for processing." : "Document uploaded. Review its processing status and proposed fields below.", error: false };
}

export async function retryDocumentProcessingAction(clientCaseId: string, documentId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const document = await db.uploadedDocument.findFirstOrThrow({ where: { id: documentId, clientCaseId } });
  if (document.processingStatus !== "FAILED" || document.quarantineStatus !== "CLEAR" || document.deletedAt) throw new Error("Only a safe failed document can be retried.");
  await db.uploadedDocument.update({ where: { id: documentId }, data: { processingStatus: "PROCESSING", processingError: null } });
  await enqueueBackgroundJob("PROCESS_DOCUMENT", { documentId: document.id, userId: user.id }, `document:${document.id}:retry:${Date.now()}`);
  if (!env.ENFORCE_PRODUCTION_CONFIG) await runNextOrganizationJob("local-inline-worker");
  revalidatePath(`/cases/${clientCaseId}/documents`);
}

export async function reviewExtractionAction(clientCaseId: string, fieldId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "REVIEWER", "SUPERVISOR"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const input = reviewSchema.parse({ status: formData.get("status"), reviewedValue: String(formData.get("reviewedValue") ?? ""), reason: String(formData.get("reason") ?? "") });
  if (input.status === "EDITED" && !input.reviewedValue) throw new Error("Enter the corrected value before saving an edit.");
  if (!["APPROVED", "EDITED"].includes(input.status) && input.reason.length < 3) throw new Error("Add a reason for this review state.");
  const field = await db.extractedField.findFirstOrThrow({ where: { id: fieldId, uploadedDocument: { clientCaseId, quarantineStatus: "CLEAR", deletedAt: null } } });
  const afterValue = input.status === "EDITED" ? input.reviewedValue : input.status === "APPROVED" ? input.reviewedValue || field.extractedValue : null;
  await db.$transaction(async (tx) => {
    const revision = field.reviewerRevision + 1;
    await tx.extractedFieldRevision.create({ data: { extractedFieldId: field.id, reviewerId: user.id, beforeValue: field.reviewedValue ?? field.normalizedValue ?? field.extractedValue, afterValue, beforeStatus: field.reviewStatus, afterStatus: input.status, beforeReason: field.reviewReason, afterReason: input.reason || null, sourceRevision: revision } });
    await tx.extractedField.update({ where: { id: field.id }, data: { reviewStatus: input.status, validationState: validationStateByReview[input.status], reviewReason: input.reason || null, reviewedValue: afterValue, reviewerId: user.id, reviewedAt: new Date(), reviewerRevision: revision } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId, action: input.status === "EDITED" ? "EXTRACTION_EDITED" : `EXTRACTION_${input.status}`, entityType: "ExtractedField", entityId: field.id, metadata: `Extraction review revision ${revision} recorded; values remain restricted to the case review surface` } });
  });
  await runWithOrganization(user.organizationId, () => invalidateCaseDrafts(clientCaseId, user.id, "Reviewed source-document information changed."));
  activateOrganizationContext(user);
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
}

export async function batchApproveHighConfidenceAction(clientCaseId: string, documentId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "REVIEWER", "SUPERVISOR"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const threshold = z.coerce.number().min(0.75).max(1).default(0.9).parse(formData.get("threshold") ?? 0.9);
  const document = await db.uploadedDocument.findFirstOrThrow({ where: { id: documentId, clientCaseId, quarantineStatus: "CLEAR", deletedAt: null }, include: { extractedFields: true } });
  const eligible = document.extractedFields.filter((field) => field.reviewStatus === "PENDING" && field.confidence >= threshold && field.sourcePage !== null && Boolean(field.sourceText?.trim()));
  if (!eligible.length) throw new Error("No pending fields meet the confidence and evidence threshold.");
  await db.$transaction(async (tx) => {
    for (const field of eligible) {
      const revision = field.reviewerRevision + 1;
      await tx.extractedFieldRevision.create({ data: { extractedFieldId: field.id, reviewerId: user.id, beforeValue: field.reviewedValue ?? field.normalizedValue ?? field.extractedValue, afterValue: field.extractedValue, beforeStatus: field.reviewStatus, afterStatus: "APPROVED", beforeReason: field.reviewReason, afterReason: `Batch approved at ${Math.round(threshold * 100)}% confidence`, sourceRevision: revision } });
      await tx.extractedField.update({ where: { id: field.id }, data: { reviewStatus: "APPROVED", validationState: "VALID", reviewedValue: field.extractedValue, reviewReason: `Batch approved at ${Math.round(threshold * 100)}% confidence`, reviewerId: user.id, reviewedAt: new Date(), reviewerRevision: revision } });
      await tx.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "EXTRACTION_BATCH_APPROVED", entityType: "ExtractedField", entityId: field.id, metadata: `Batch approval revision ${revision}; threshold ${threshold.toFixed(2)}; source evidence present` } });
    }
  });
  await runWithOrganization(user.organizationId, () => invalidateCaseDrafts(clientCaseId, user.id, "High-confidence source-document fields were batch approved."));
  activateOrganizationContext(user);
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
}

export async function escalateExtractionAction(clientCaseId: string, fieldId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "REVIEWER", "SUPERVISOR"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const reason = z.string().trim().min(10).max(1000).parse(formData.get("reason"));
  const field = await db.extractedField.findFirstOrThrow({ where: { id: fieldId, uploadedDocument: { clientCaseId, quarantineStatus: "CLEAR", deletedAt: null } } });
  const afterReason = `Escalated to supervisor: ${reason}`;
  await db.$transaction(async (tx) => {
    const revision = field.reviewerRevision + 1;
    await tx.extractedFieldRevision.create({ data: { extractedFieldId: field.id, reviewerId: user.id, beforeValue: field.reviewedValue ?? field.normalizedValue ?? field.extractedValue, afterValue: null, beforeStatus: field.reviewStatus, afterStatus: "CONFLICTING", beforeReason: field.reviewReason, afterReason, sourceRevision: revision } });
    await tx.extractedField.update({ where: { id: field.id }, data: { reviewStatus: "CONFLICTING", validationState: "CONFLICTING_VALUE", reviewedValue: null, reviewReason: afterReason, reviewerId: user.id, reviewedAt: new Date(), reviewerRevision: revision } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "EXTRACTION_ESCALATED", entityType: "ExtractedField", entityId: field.id, metadata: `Extraction escalation revision ${revision}; reason retained in the authorized review surface` } });
  });
  await runWithOrganization(user.organizationId, () => invalidateCaseDrafts(clientCaseId, user.id, "A source-document field was escalated for supervisor review."));
  activateOrganizationContext(user);
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
}

export async function deleteDocumentAction(clientCaseId: string, documentId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const reason = z.string().trim().min(10).max(1000).parse(formData.get("reason"));
  const document = await db.uploadedDocument.findFirstOrThrow({ where: { id: documentId, clientCaseId }, include: { clientCase: { select: { legalHoldAt: true } }, draftDocuments: { include: { draft: { select: { status: true } } } } } });
  if (document.clientCase.legalHoldAt) throw new Error("Documents under a case legal hold cannot be deleted.");
  if (document.deletedAt) throw new Error("Document is already deleted.");
  if (document.processingStatus === "PROCESSING") throw new Error("Wait for document processing to finish before deletion.");
  if (document.draftDocuments.some((item) => item.selected && ["GENERATED", "SUBMITTED_FOR_REVIEW", "APPROVED"].includes(item.draft.status))) throw new Error("This document is covered by a generated or reviewed application. Create a new application version before deleting it.");
  if (document.storageKey) await deleteObject(document.storageKey);
  await db.$transaction([
    db.uploadedDocument.update({ where: { id: document.id }, data: { storageKey: null, storagePath: null, processingStatus: "DELETED", quarantineStatus: "DELETED", deletedAt: new Date(), deletedById: user.id, deletionReason: reason } }),
    db.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "DOCUMENT_DELETED", entityType: "UploadedDocument", entityId: document.id, metadata: "Managed encrypted object deleted after restriction checks; deletion reason retained outside audit metadata" } }),
  ]);
  await runWithOrganization(user.organizationId, () => invalidateCaseDrafts(clientCaseId, user.id, "A source document was deleted."));
  activateOrganizationContext(user);
  revalidatePath(`/cases/${clientCaseId}/documents`);
}
