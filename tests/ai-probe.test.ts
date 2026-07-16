import { afterEach, describe, expect, it, vi } from "vitest";
import { probeAiProvider, type AiProbeConfig, type AiProbeFetch } from "@/lib/setup/ai-probe";

const key = "synthetic-provider-key";

function successfulFetch() {
  return vi.fn<AiProbeFetch>().mockResolvedValue(new Response("{}", { status: 200 }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AI provider connection probe", () => {
  it("reports a disabled provider as unsupported without making a request", async () => {
    const fetcher = successfulFetch();
    await expect(probeAiProvider({ provider: "disabled" }, fetcher)).resolves.toEqual({ status: "UNSUPPORTED", code: "AI_PROVIDER_DISABLED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects incomplete configuration without making a request", async () => {
    const fetcher = successfulFetch();
    await expect(probeAiProvider({ provider: "groq", model: "model" }, fetcher)).resolves.toEqual({ status: "FAILED", code: "AI_CONFIGURATION_INVALID" });
    await expect(probeAiProvider({ provider: "groq", apiKey: key }, fetcher)).resolves.toEqual({ status: "FAILED", code: "AI_CONFIGURATION_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  const providers: { config: AiProbeConfig; modelUrl: string; inferenceUrl: string; credentialHeader: string }[] = [
    { config: { provider: "anthropic", model: "claude-test", apiKey: key }, modelUrl: "https://api.anthropic.com/v1/models/claude-test", inferenceUrl: "https://api.anthropic.com/v1/messages", credentialHeader: "x-api-key" },
    { config: { provider: "gemini", model: "gemini-test", apiKey: key }, modelUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-test", inferenceUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent", credentialHeader: "x-goog-api-key" },
    { config: { provider: "groq", model: "groq-test", apiKey: key }, modelUrl: "https://api.groq.com/openai/v1/models/groq-test", inferenceUrl: "https://api.groq.com/openai/v1/chat/completions", credentialHeader: "Authorization" },
    { config: { provider: "openrouter", model: "vendor/model-test", apiKey: key, httpReferer: "https://example.test", appTitle: "Synthetic setup probe" }, modelUrl: "https://openrouter.ai/api/v1/model/vendor/model-test", inferenceUrl: "https://openrouter.ai/api/v1/chat/completions", credentialHeader: "Authorization" },
    { config: { provider: "sambanova", model: "samba-test", apiKey: key }, modelUrl: "https://api.sambanova.ai/v1/models/samba-test", inferenceUrl: "https://api.sambanova.ai/v1/chat/completions", credentialHeader: "Authorization" },
    { config: { provider: "cerebras", model: "cerebras-test", apiKey: key }, modelUrl: "https://api.cerebras.ai/v1/models/cerebras-test", inferenceUrl: "https://api.cerebras.ai/v1/chat/completions", credentialHeader: "Authorization" },
    { config: { provider: "mistral", model: "mistral-test", apiKey: key }, modelUrl: "https://api.mistral.ai/v1/models/mistral-test", inferenceUrl: "https://api.mistral.ai/v1/chat/completions", credentialHeader: "Authorization" },
  ];

  it.each(providers)("checks the exact $config.provider model before one tiny inference", async ({ config, modelUrl, inferenceUrl, credentialHeader }) => {
    const fetcher = successfulFetch();
    const result = await probeAiProvider(config, fetcher);
    expect(result).toEqual({ status: "PASSED", code: "AI_PROVIDER_MODEL_OK" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe(modelUrl);
    expect(fetcher.mock.calls[0][1]?.method).toBe("GET");
    expect(fetcher.mock.calls[1][0]).toBe(inferenceUrl);
    expect(fetcher.mock.calls[1][1]?.method).toBe("POST");
    const modelHeaders = fetcher.mock.calls[0][1]?.headers as Record<string, string>;
    expect(modelHeaders[credentialHeader]).toContain(key);
    const inferenceBody = String(fetcher.mock.calls[1][1]?.body);
    expect(`${String(fetcher.mock.calls[1][0])}${inferenceBody}`).toContain(String(config.model));
    expect(inferenceBody).toContain("Reply with OK.");
    expect(inferenceBody).not.toContain(key);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(Object.keys(result).sort()).toEqual(["code", "status"]);
  });

  it("keeps the Gemini key in the x-goog-api-key header and out of both URLs", async () => {
    const fetcher = successfulFetch();
    await probeAiProvider({ provider: "gemini", model: "gemini-test", apiKey: key }, fetcher);
    for (const [url, init] of fetcher.mock.calls) {
      expect(String(url)).not.toContain(key);
      expect(String(url)).not.toContain("?key=");
      expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(key);
    }
  });

  it("uses OpenRouter attribution and zero-data-retention routing without exposing credentials", async () => {
    const fetcher = successfulFetch();
    await probeAiProvider({ provider: "openrouter", model: "vendor/model", apiKey: key, httpReferer: "https://example.test", appTitle: "Synthetic probe" }, fetcher);
    const headers = fetcher.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers["HTTP-Referer"]).toBe("https://example.test");
    expect(headers["X-OpenRouter-Title"]).toBe("Synthetic probe");
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({ provider: { zdr: true }, max_tokens: 1 });
  });

  it.each([
    [401, "AI_AUTHENTICATION_FAILED"],
    [403, "AI_AUTHENTICATION_FAILED"],
    [404, "AI_MODEL_UNAVAILABLE"],
    [410, "AI_MODEL_UNAVAILABLE"],
    [429, "AI_RATE_LIMITED"],
    [503, "AI_MODEL_CHECK_FAILED"],
  ] as const)("maps model-check HTTP %s to an allowlisted code", async (status, code) => {
    const fetcher = vi.fn<AiProbeFetch>().mockResolvedValue(new Response("provider detail that must not escape", { status }));
    const result = await probeAiProvider({ provider: "groq", model: "groq-test", apiKey: key }, fetcher);
    expect(result).toEqual({ status: "FAILED", code });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("provider detail");
  });

  it("returns a fixed inference failure without response content or another attempt", async () => {
    const fetcher = vi.fn<AiProbeFetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("raw provider error with secret material", { status: 500 }));
    const result = await probeAiProvider({ provider: "mistral", model: "mistral-test", apiKey: key }, fetcher);
    expect(result).toEqual({ status: "FAILED", code: "AI_INFERENCE_FAILED" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("raw provider error");
  });

  it("returns fixed network failure codes without exception text", async () => {
    const modelFailure = vi.fn<AiProbeFetch>().mockRejectedValue(new Error(`network failure ${key}`));
    await expect(probeAiProvider({ provider: "groq", model: "groq-test", apiKey: key }, modelFailure)).resolves.toEqual({ status: "FAILED", code: "AI_MODEL_CHECK_FAILED" });

    const inferenceFailure = vi.fn<AiProbeFetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockRejectedValueOnce(new Error(`network failure ${key}`));
    await expect(probeAiProvider({ provider: "groq", model: "groq-test", apiKey: key }, inferenceFailure)).resolves.toEqual({ status: "FAILED", code: "AI_INFERENCE_FAILED" });
  });

  it("enforces one 20-second deadline across the complete probe even when fetch ignores abort", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<AiProbeFetch>().mockImplementation(() => new Promise<Response>(() => undefined));
    const pending = probeAiProvider({ provider: "groq", model: "groq-test", apiKey: key }, fetcher);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toEqual({ status: "FAILED", code: "AI_PROBE_TIMEOUT" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
