import { z } from "zod";

export const processingResultSchema = z.object({
  category: z.string().trim().min(1),
  expirationDate: z.string().nullable(),
  fields: z.array(z.object({
    name: z.string().trim().min(1),
    value: z.string(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive().nullable(),
    sourceText: z.string().trim().max(2000).nullable(),
  })),
  warnings: z.array(z.string()),
});

export const classificationResultSchema = z.object({
  pages: z.array(z.object({ page: z.number().int().positive(), category: z.string().trim().min(1), confidence: z.number().min(0).max(1), reason: z.string().trim().min(1) })),
  warnings: z.array(z.string()),
});

export type DocumentProcessingResult = z.infer<typeof processingResultSchema>;
export type DocumentClassificationResult = z.infer<typeof classificationResultSchema>;
export type DocumentDataClass = "SYNTHETIC" | "CUSTOMER_SENSITIVE";
export type DocumentProcessingInput = { filename: string; mimeType: string; bytes: Uint8Array; category?: string; dataClass?: DocumentDataClass };

export interface DocumentProcessor {
  processDocument(input: DocumentProcessingInput): Promise<DocumentProcessingResult>;
}
