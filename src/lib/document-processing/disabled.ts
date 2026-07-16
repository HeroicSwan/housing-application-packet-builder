import type { DocumentProcessingResult, DocumentProcessor } from "./types";

export class DisabledDocumentProcessor implements DocumentProcessor {
  async processDocument(): Promise<DocumentProcessingResult> {
    throw new Error("Document processing is disabled by configuration.");
  }
}
