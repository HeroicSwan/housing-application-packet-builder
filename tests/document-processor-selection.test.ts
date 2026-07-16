import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const extractionJson = JSON.stringify({ category: "OTHER", expirationDate: null, fields: [], warnings: [] });
const chatResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: extractionJson } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
const textInput = { filename: "note.txt", mimeType: "text/plain", bytes: new TextEncoder().encode("synthetic") };

// Developer machines may carry provider variables (proxies, unrelated tooling); the selection tests
// must observe only what each test stubs.
const ambientProviderVariables = [
  "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "SAMBANOVA_API_KEY", "CEREBRAS_API_KEY", "MISTRAL_API_KEY",
  "OPENAI_API_KEY", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "XAI_API_KEY", "DEEPSEEK_API_KEY",
  "TOGETHER_API_KEY", "FIREWORKS_API_KEY", "COHERE_API_KEY", "PERPLEXITY_API_KEY", "OLLAMA_BASE_URL", "OLLAMA_API_KEY",
  "CUSTOM_OPENAI_BASE_URL", "CUSTOM_OPENAI_API_KEY", "CUSTOM_OPENAI_MODEL",
];

beforeEach(() => {
  for (const name of ambientProviderVariables) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

  it.each([
    ["openai", { OPENAI_API_KEY: Buffer.from("Op9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8") }, "https://api.openai.com/v1/chat/completions"],
    ["xai", { XAI_API_KEY: Buffer.from("Xa9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8") }, "https://api.x.ai/v1/chat/completions"],
    ["deepseek", { DEEPSEEK_API_KEY: Buffer.from("Ds9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8") }, "https://api.deepseek.com/v1/chat/completions"],
    ["together", { TOGETHER_API_KEY: Buffer.from("Tg9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8") }, "https://api.together.xyz/v1/chat/completions"],
    ["fireworks", { FIREWORKS_API_KEY: Buffer.from("Fw9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8") }, "https://api.fireworks.ai/inference/v1/chat/completions"],
    ["cohere", { COHERE_API_KEY: Buffer.from("Ch9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju").toString("utf8") }, "https://api.cohere.ai/compatibility/v1/chat/completions"],
  ] as const)("routes %s through its OpenAI-compatible endpoint with a bearer key", async (provider, extraEnv, endpoint) => {
    vi.stubEnv("DOCUMENT_PROCESSOR", provider);
    for (const [name, value] of Object.entries(extraEnv)) vi.stubEnv(name, value);
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { getDocumentProcessor } = await import("@/lib/document-processing");
    const result = await getDocumentProcessor().processDocument(textInput);

    expect(result.category).toBe("OTHER");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(endpoint);
    const headers = fetchSpy.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer [A-Z][a-z]9Kq7/);
  });

  it("sends the Azure OpenAI api-key header to the deployment-scoped endpoint", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "azure-openai");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "Az9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju");
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://synthetic-resource.openai.azure.com");
    vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini");
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { getDocumentProcessor } = await import("@/lib/document-processing");
    await getDocumentProcessor().processDocument(textInput);

    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://synthetic-resource.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21");
    const headers = fetchSpy.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["api-key"]).toBe("Az9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju");
    expect(headers.Authorization).toBeUndefined();
  });

  it("allows keyless local Ollama processing against the configured base URL", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "ollama");
    vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2-vision");
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { getDocumentProcessor } = await import("@/lib/document-processing");
    await getDocumentProcessor().processDocument(textInput);

    expect(String(fetchSpy.mock.calls[0][0])).toBe("http://127.0.0.1:11434/v1/chat/completions");
    const headers = fetchSpy.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("routes a custom OpenAI-compatible endpoint and omits response_format for unknown gateways", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "custom");
    vi.stubEnv("CUSTOM_OPENAI_BASE_URL", "https://gateway.internal.example/v1");
    vi.stubEnv("CUSTOM_OPENAI_MODEL", "internal-model");
    vi.stubEnv("CUSTOM_OPENAI_PROVIDER_NAME", "Internal Gateway");
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { getDocumentProcessor } = await import("@/lib/document-processing");
    await getDocumentProcessor().processDocument(textInput);

    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://gateway.internal.example/v1/chat/completions");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.model).toBe("internal-model");
    expect(body.response_format).toBeUndefined();
  });

  it("omits response_format for Perplexity while keeping the JSON extraction contract", async () => {
    vi.stubEnv("DOCUMENT_PROCESSOR", "perplexity");
    vi.stubEnv("PERPLEXITY_API_KEY", "Px9Kq7Wv4Nc8Rz2Pd6Ty1Ha5Lf3Xs0Ju");
    const fetchSpy = vi.fn().mockResolvedValue(chatResponse());
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { getDocumentProcessor } = await import("@/lib/document-processing");
    await getDocumentProcessor().processDocument(textInput);

    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://api.perplexity.ai/chat/completions");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.response_format).toBeUndefined();
  });

  it("fails closed when a keyed adapter runs without its API key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { OpenAICompatibleDocumentProcessor } = await import("@/lib/document-processing/openai-compatible");
    const processor = new OpenAICompatibleDocumentProcessor({ name: "OpenAI", apiKey: undefined, model: "gpt-test", endpoint: "https://api.openai.com/v1/chat/completions" });
    await expect(processor.processDocument(textInput)).rejects.toThrow("OpenAI processing is enabled but its API key is missing.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
