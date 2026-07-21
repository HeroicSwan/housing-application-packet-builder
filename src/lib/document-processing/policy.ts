import type { DocumentProcessor, DocumentProcessingInput, DocumentProcessingResult } from "./types";

export class CustomerDataAiBlockedError extends Error {
  constructor() {
    super("Non-local AI processing is disabled for customer-sensitive documents. Use local Ollama or manual review.");
    this.name = "CustomerDataAiBlockedError";
  }
}

export class CustomerDataPolicyProcessor implements DocumentProcessor {
  constructor(private readonly inner: DocumentProcessor, private readonly provider: string) {}

  processDocument(input: DocumentProcessingInput): Promise<DocumentProcessingResult> {
    if (input.dataClass !== "SYNTHETIC" && !["disabled", "mock", "ollama"].includes(this.provider)) throw new CustomerDataAiBlockedError();
    return this.inner.processDocument(input);
  }
}
