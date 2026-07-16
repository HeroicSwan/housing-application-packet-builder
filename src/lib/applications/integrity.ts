import "server-only";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/security/encryption";

export async function computeDraftContentDigest(draftId: string) {
  const draft = await db.applicationDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: {
      fields: { include: { templateField: true }, orderBy: { templateField: { displayOrder: "asc" } } },
      documents: { include: { uploadedDocument: true }, orderBy: { uploadedDocumentId: "asc" } },
    },
  });
  return sha256(JSON.stringify({
    templateId: draft.templateId,
    templateVersion: draft.templateVersion,
    fields: draft.fields.filter((field) => field.templateField.canonicalFieldPath !== "consentConfirmed" && !["SIGNATURE", "SIGNATURE_PLACEHOLDER"].includes(field.templateField.fieldType)).map((field) => ({ key: field.templateField.fieldKey, value: field.finalValue, review: field.reviewState, validation: field.validationState })),
    documents: draft.documents.filter((item) => item.selected).map((item) => ({ id: item.uploadedDocumentId, checksum: item.uploadedDocument.checksumSha256, authorized: item.authorized })),
  }));
}

export async function invalidateDraftIntegrity(draftId: string, userId: string, reason: string) {
  const draft = await db.applicationDraft.findUniqueOrThrow({ where: { id: draftId }, include: { signature: true } });
  const protectedState = Boolean(draft.signature && !draft.signature.invalidatedAt) || Boolean(draft.approvedDigest) || ["GENERATED", "SUBMITTED_FOR_REVIEW", "APPROVED"].includes(draft.status);
  if (!protectedState) return false;
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.applicationDraft.update({ where: { id: draftId }, data: { status: "NEEDS_INFORMATION", generatedAt: null, contentDigest: null, approvedDigest: null, approvedAt: null, approvedById: null, approvalInvalidatedAt: now, approvalInvalidationReason: reason } });
    if (draft.signature) await tx.applicationSignature.update({ where: { draftId }, data: { invalidatedAt: now, invalidationReason: reason, finalDocumentHash: null } });
    await tx.auditEvent.create({ data: { userId, clientCaseId: draft.clientCaseId, action: "APPLICATION_APPROVAL_INVALIDATED", entityType: "ApplicationDraft", entityId: draftId, metadata: "Covered application data changed; prior signature, generation, and approval can no longer be used" } });
  });
  return true;
}

export async function invalidateCaseDrafts(clientCaseId: string, userId: string, reason: string) {
  const drafts = await db.applicationDraft.findMany({ where: { clientCaseId }, select: { id: true } });
  for (const draft of drafts) await invalidateDraftIntegrity(draft.id, userId, reason);
}
