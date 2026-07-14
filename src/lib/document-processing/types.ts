import { z } from "zod";

export const processingResultSchema = z.object({
  category: z.string(),
  expirationDate: z.string().nullable(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.string(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive().nullable(),
    sourceText: z.string().nullable(),
  })),
  warnings: z.array(z.string()),
});

export type DocumentProcessingResult = z.infer<typeof processingResultSchema>;
export type DocumentProcessingInput = { filename: string; mimeType: string; bytes: Uint8Array; category?: string };

export interface DocumentProcessor {
  processDocument(input: DocumentProcessingInput): Promise<DocumentProcessingResult>;
}
