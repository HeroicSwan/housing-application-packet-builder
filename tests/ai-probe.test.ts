import { afterEach, describe, expect, it, vi } from "vitest";
import { probeAiProvider, type AiProbeFetch } from "@/lib/setup/ai-probe";

const key = "synthetic-local-key";

function successfulFetch() {
  return vi.fn<AiProbeFetch>().mockResolvedValue(new Response("{}", { status: 200 }));
}

afterEach(() => vi.useRealTimers());

describe("local AI provider connection probe", () => {
  it("reports disabled without making a request", async () => {
    const fetcher = successfulFetch();
    await expect(probeAiProvider({ provider: "disabled" }, fetcher)).resolves.toEqual({ status: "UNSUPPORTED", code: "AI_PROVIDER_DISABLED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects non-local endpoints without making a request", async () => {
    const fetcher = successfulFetch();
    await expect(probeAiProvider({ provider: "ollama", model: "qwen2.5vl:7b", baseUrl: "https://api.example.com" }, fetcher)).resolves.toEqual({ status: "FAILED", code: "AI_CONFIGURATION_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("probes localhost Ollama with a synthetic request", async () => {
    const fetcher = successfulFetch();
    await expect(probeAiProvider({ provider: "ollama", model: "qwen2.5vl:7b", apiKey: key }, fetcher)).resolves.toEqual({ status: "PASSED", code: "AI_PROVIDER_MODEL_OK" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe("http://127.0.0.1:11434/api/tags");
    expect(fetcher.mock.calls[1][0]).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(String(fetcher.mock.calls[1][1]?.body)).toContain("Reply with OK.");
    expect(String(fetcher.mock.calls[1][1]?.body)).not.toContain(key);
  });

  it("maps local model and inference failures to fixed codes", async () => {
    const modelFailure = vi.fn<AiProbeFetch>().mockResolvedValue(new Response("", { status: 503 }));
    await expect(probeAiProvider({ provider: "ollama", model: "qwen2.5vl:7b" }, modelFailure)).resolves.toEqual({ status: "FAILED", code: "AI_MODEL_CHECK_FAILED" });
    const inferenceFailure = vi.fn<AiProbeFetch>().mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(probeAiProvider({ provider: "ollama", model: "qwen2.5vl:7b" }, inferenceFailure)).resolves.toEqual({ status: "FAILED", code: "AI_INFERENCE_FAILED" });
  });
});
