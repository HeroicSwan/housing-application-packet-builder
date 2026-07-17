import { db } from "@/lib/db";
import { getLegacyOrStoredObject } from "@/lib/storage";
import { getDocumentProcessor } from "@/lib/document-processing";
import { processingResultSchema } from "@/lib/document-processing/types";
import { sha256 } from "@/lib/security/encryption";

export async function processStoredDocument(documentId: string, userId: string) {
  const document = await db.uploadedDocument.findUniqueOrThrow({ where: { id: documentId } });
  if (document.quarantineStatus !== "CLEAR" || document.deletedAt) throw new Error("Quarantined or deleted documents cannot be processed.");
  try {
    const bytes = await getLegacyOrStoredObject(document);
    const result = processingResultSchema.parse(await getDocumentProcessor().processDocument({ filename: document.originalFilename, mimeType: document.fileType, bytes, category: document.documentCategory, dataClass: "CUSTOMER_SENSITIVE" }));
    await db.$transaction(async (tx) => {
      await tx.extractedField.deleteMany({ where: { uploadedDocumentId: document.id } });
      await tx.uploadedDocument.update({ where: { id: document.id }, data: { documentCategory: result.category, processingStatus: "COMPLETED", processingError: null, expirationDate: result.expirationDate ? new Date(`${result.expirationDate}T12:00:00Z`) : null, extractedFields: { create: result.fields.map((field) => ({ fieldName: field.name, extractedValue: field.value, normalizedValue: field.value.normalize("NFKC").trim(), confidence: field.confidence, sourcePage: field.sourcePage, sourceText: field.sourceText, modelOutputDigest: sha256(JSON.stringify({ name: field.name, value: field.value, confidence: field.confidence, sourcePage: field.sourcePage, sourceText: field.sourceText })) })) } } });
      await tx.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_PROCESSED", entityType: "UploadedDocument", entityId: document.id, metadata: `Configured processor completed with ${result.fields.length} proposed field(s); values not logged` } });
    });
  } catch (error) {
    await db.$transaction([
      db.uploadedDocument.update({ where: { id: document.id }, data: { processingStatus: "FAILED", processingError: "Processing did not complete. Check the file and retry." } }),
      db.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_PROCESSING_FAILED", entityType: "UploadedDocument", entityId: document.id, metadata: "Processor failed safely; error details and document content not logged" } }),
    ]);
    throw error;
  }
}
