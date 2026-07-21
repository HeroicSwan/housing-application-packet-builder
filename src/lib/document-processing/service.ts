import { db } from "@/lib/db";
import { getLegacyOrStoredObject } from "@/lib/storage";
import { getDocumentProcessor } from "@/lib/document-processing";
import { processingResultSchema } from "@/lib/document-processing/types";
import { sha256 } from "@/lib/security/encryption";
import { env } from "@/lib/env";

async function markCaseFieldConflicts(clientCaseId: string) {
  const fields = await db.extractedField.findMany({ where: { uploadedDocument: { clientCaseId, deletedAt: null, quarantineStatus: "CLEAR" }, reviewStatus: { not: "REJECTED" } }, select: { id: true, fieldName: true, extractedValue: true } });
  const grouped = new Map<string, typeof fields>();
  for (const field of fields) { const group = grouped.get(field.fieldName) ?? []; group.push(field); grouped.set(field.fieldName, group); }
  let conflicts = 0;
  for (const group of grouped.values()) {
    const values = new Set(group.map((field) => field.extractedValue.normalize("NFKC").trim().toLowerCase()).filter(Boolean));
    if (values.size < 2) continue;
    conflicts += 1;
    await db.extractedField.updateMany({ where: { id: { in: group.map((field) => field.id) } }, data: { reviewStatus: "CONFLICTING", validationState: "CONFLICTING_VALUE", reviewReason: "The same field has different values across documents; compare the source pages and resolve this conflict." } });
  }
  return conflicts;
}

export async function processStoredDocument(documentId: string, userId: string) {
  const document = await db.uploadedDocument.findUniqueOrThrow({ where: { id: documentId }, include: { clientCase: { select: { organizationId: true } } } });
  if (document.quarantineStatus !== "CLEAR" || document.deletedAt) throw new Error("Quarantined or deleted documents cannot be processed.");
  try {
    const bytes = await getLegacyOrStoredObject(document);
    const profile = await db.documentProfile.findFirst({ where: { organizationId: document.clientCase.organizationId, category: document.documentCategory, active: true } });
    const result = processingResultSchema.parse(await getDocumentProcessor().processDocument({ filename: document.originalFilename, mimeType: document.fileType, bytes, category: document.documentCategory, customPrompt: profile?.extractionPrompt ?? undefined, dataClass: "CUSTOMER_SENSITIVE" }));
    const processingWarnings = result.warnings.filter(Boolean);
    const processingStatus = env.DOCUMENT_PROCESSOR === "ollama" && processingWarnings.length ? "COMPLETED_WITH_REVIEW" : "COMPLETED";
    await db.$transaction(async (tx) => {
      await tx.extractedField.deleteMany({ where: { uploadedDocumentId: document.id } });
      await tx.uploadedDocument.update({ where: { id: document.id }, data: { documentCategory: result.category, processingStatus, processingError: processingWarnings.length ? processingWarnings.slice(0, 4).join(" ") : null, expirationDate: result.expirationDate ? new Date(`${result.expirationDate}T12:00:00Z`) : null, extractedFields: { create: result.fields.map((field) => ({ fieldName: field.name, extractedValue: field.value, normalizedValue: field.value.normalize("NFKC").trim(), confidence: field.confidence, sourcePage: field.sourcePage, sourceText: field.sourceText, modelOutputDigest: sha256(JSON.stringify({ name: field.name, value: field.value, confidence: field.confidence, sourcePage: field.sourcePage, sourceText: field.sourceText })) })) } } });
      await tx.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_PROCESSED", entityType: "UploadedDocument", entityId: document.id, metadata: `Configured processor completed with ${result.fields.length} proposed field(s), ${processingWarnings.length} abstention/review warning(s); values not logged` } });
    });
    const conflictCount = await markCaseFieldConflicts(document.clientCaseId);
    if (conflictCount) await db.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_FIELD_CONFLICTS_DETECTED", entityType: "UploadedDocument", entityId: document.id, metadata: `${conflictCount} field conflict group(s) marked for human review; values not logged` } });
  } catch (error) {
    await db.$transaction([
      db.uploadedDocument.update({ where: { id: document.id }, data: { processingStatus: "FAILED", processingError: "Processing did not complete. Check the file and retry." } }),
      db.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_PROCESSING_FAILED", entityType: "UploadedDocument", entityId: document.id, metadata: "Processor failed safely; error details and document content not logged" } }),
    ]);
    throw error;
  }
}
