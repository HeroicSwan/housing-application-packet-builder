import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const extractionJson = JSON.stringify({ category: "OTHER", expirationDate: null, fields: [], warnings: [] });
const chatResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: extractionJson } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
const textInput = { filename: "note.txt", mimeType: "text/plain", bytes: new TextEncoder().encode("synthetic"), dataClass: "SYNTHETIC" as const };

beforeEach(() => {
  vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
  vi.stubEnv("OLLAMA_MODEL", "qwen2.5vl:7b");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("local document processor selection", () => {
  it("selects a fail-closed processor when disabled", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "disabled");
    vi.resetModules();
    const [{ getDocumentProcessor }, { DisabledDocumentProcessor }] = await Promise.all([import("@/lib/document-processing"), import("@/lib/document-processing/disabled")]);
    expect(getDocumentProcessor()).toBeInstanceOf(DisabledDocumentProcessor);
  });

  it("routes synthetic extraction only to localhost Ollama", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "ollama");
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { getDocumentProcessor } = await import("@/lib/document-processing");
    const result = await getDocumentProcessor().processDocument(textInput);
    expect(result.category).toBe("OTHER");
    expect(String(fetchSpy.mock.calls[0][0])).toBe("http://127.0.0.1:11434/v1/chat/completions");
  });

  it("allows customer-sensitive payloads only through local Ollama", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "ollama");
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { getDocumentProcessor } = await import("@/lib/document-processing");
    await expect(getDocumentProcessor().processDocument({ ...textInput, dataClass: "CUSTOMER_SENSITIVE" })).resolves.toMatchObject({ category: "OTHER" });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("rejects cloud provider configuration at environment parsing", async () => {
    const { parseEnvironment } = await import("@/lib/env-schema");
    expect(() => parseEnvironment({ NODE_ENV: "test", DATABASE_URL: "file:./dev.db", DOCUMENT_PROCESSOR: "openai" })).toThrow("Invalid option");
  });
});
