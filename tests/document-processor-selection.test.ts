import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("document processor selection", () => {
  it("selects a fail-closed processor when document processing is disabled", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "disabled");
    vi.resetModules();

    const [{ getDocumentProcessor }, { DisabledDocumentProcessor }] = await Promise.all([
      import("@/lib/document-processing"),
      import("@/lib/document-processing/disabled"),
    ]);
    const processor = getDocumentProcessor();

    expect(processor).toBeInstanceOf(DisabledDocumentProcessor);
    await expect(processor.processDocument({
      filename: "identity.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array(),
    })).rejects.toThrow("Document processing is disabled by configuration.");
  });
});
