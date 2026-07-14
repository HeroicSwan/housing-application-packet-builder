"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { canAccessCase, requireRole } from "@/lib/auth/session";
import { getDocumentProcessor } from "@/lib/document-processing";
import { processingResultSchema } from "@/lib/document-processing/types";
import { sanitizeFilename, validateFileSignature, validateUpload } from "@/lib/validation/files";
import { getLegacyOrStoredObject, putObject } from "@/lib/storage";
import { scanForMalware } from "@/lib/security/malware";

const categorySchema = z.enum(["IDENTITY", "INCOME", "RESIDENCY", "HOUSEHOLD", "DISABILITY", "HOMELESSNESS_VERIFICATION", "OTHER"]);
const reviewSchema = z.object({ status: z.enum(["APPROVED", "EDITED", "REJECTED"]), reviewedValue: z.string().trim().max(500) });

async function processStoredDocument(document: { id: string; clientCaseId: string; originalFilename: string; fileType: string; storagePath: string | null; storageKey: string | null; documentCategory: string }, userId: string) {
  try {
    const bytes = await getLegacyOrStoredObject(document);
    const result = processingResultSchema.parse(await getDocumentProcessor().processDocument({ filename: document.originalFilename, mimeType: document.fileType, bytes, category: document.documentCategory }));
    await db.$transaction(async (tx) => {
      await tx.extractedField.deleteMany({ where: { uploadedDocumentId: document.id } });
      await tx.uploadedDocument.update({ where: { id: document.id }, data: { documentCategory: result.category, processingStatus: "COMPLETED", processingError: null, expirationDate: result.expirationDate ? new Date(`${result.expirationDate}T12:00:00Z`) : null, extractedFields: { create: result.fields.map((field) => ({ fieldName: field.name, extractedValue: field.value, confidence: field.confidence, sourcePage: field.sourcePage, sourceText: field.sourceText })) } } });
      await tx.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_PROCESSED", entityType: "UploadedDocument", entityId: document.id, metadata: `Mock or configured processor completed with ${result.fields.length} proposed field(s); values not logged` } });
    });
  } catch {
    await db.$transaction([
      db.uploadedDocument.update({ where: { id: document.id }, data: { processingStatus: "FAILED", processingError: "Processing did not complete. Check the file and retry." } }),
      db.auditEvent.create({ data: { userId, clientCaseId: document.clientCaseId, action: "DOCUMENT_PROCESSING_FAILED", entityType: "UploadedDocument", entityId: document.id, metadata: "Processor failed safely; error details and document content not logged" } }),
    ]);
  }
}

export type UploadFormState = { message: string; error: boolean };

export async function uploadDocumentAction(clientCaseId: string, _previousState: UploadFormState, formData: FormData): Promise<UploadFormState> {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose a document to upload.", error: true };
  const validation = validateUpload(file, env.MAX_UPLOAD_MB); if (!validation.valid) return { message: validation.error, error: true };
  const parsedCategory = categorySchema.safeParse(formData.get("category")); if (!parsedCategory.success) return { message: "Choose a valid document category.", error: true }; const category = parsedCategory.data;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateFileSignature(bytes, file.type)) return { message: "The file contents do not match the selected PDF or image type.", error: true };
  await scanForMalware(bytes);
  const safeName = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const stored = await putObject(`documents/${clientCaseId}/${safeName}`, bytes, file.type);
  const document = await db.$transaction(async (tx) => {
    const created = await tx.uploadedDocument.create({ data: { clientCaseId, originalFilename: file.name, safeFilename: safeName, fileType: file.type, storageKey: stored.key, storageProvider: stored.provider, checksumSha256: stored.checksum, sizeBytes: stored.size, documentCategory: category, processingStatus: "PROCESSING", uploadedById: user.id } });
    await tx.auditEvent.create({ data: { userId: user.id, clientCaseId, action: "DOCUMENT_UPLOADED", entityType: "UploadedDocument", entityId: created.id, metadata: `Document category: ${category}; content and original filename not logged` } });
    return created;
  });
  await processStoredDocument(document, user.id);
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
  return { message: "Document uploaded. Review its processing status and proposed fields below.", error: false };
}

export async function retryDocumentProcessingAction(clientCaseId: string, documentId: string) {
  const user = await requireRole(["CASEWORKER"]); if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const document = await db.uploadedDocument.findFirstOrThrow({ where: { id: documentId, clientCaseId } });
  if (document.processingStatus !== "FAILED") throw new Error("Only failed document processing can be retried.");
  await db.uploadedDocument.update({ where: { id: documentId }, data: { processingStatus: "PROCESSING", processingError: null } });
  await processStoredDocument(document, user.id);
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
}

export async function reviewExtractionAction(clientCaseId: string, fieldId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER", "REVIEWER"]); if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const input = reviewSchema.parse({ status: formData.get("status"), reviewedValue: String(formData.get("reviewedValue") ?? "") });
  if (input.status === "EDITED" && !input.reviewedValue) throw new Error("Enter the corrected value before saving an edit.");
  const field = await db.extractedField.findFirstOrThrow({ where: { id: fieldId, uploadedDocument: { clientCaseId } } });
  await db.$transaction([
    db.extractedField.update({ where: { id: field.id }, data: { reviewStatus: input.status, reviewedValue: input.status === "EDITED" ? input.reviewedValue : input.status === "APPROVED" ? input.reviewedValue || field.extractedValue : null, reviewerId: user.id, reviewedAt: new Date() } }),
    db.auditEvent.create({ data: { userId: user.id, clientCaseId, action: input.status === "EDITED" ? "EXTRACTION_EDITED" : `EXTRACTION_${input.status}`, entityType: "ExtractedField", entityId: field.id, metadata: "Extraction review completed; original and reviewed values not logged" } }),
  ]);
  revalidatePath(`/cases/${clientCaseId}/documents`);
  revalidatePath(`/cases/${clientCaseId}/requirements`);
}
