import "server-only";

export type AiProbeProvider = "disabled" | "ollama";
export type AiProbeConfig = { provider: AiProbeProvider; model?: string; apiKey?: string; baseUrl?: string };
export type AiProbeResult =
  | { status: "PASSED"; code: "AI_PROVIDER_MODEL_OK" }
  | { status: "UNSUPPORTED"; code: "AI_PROVIDER_DISABLED" | "AI_PROVIDER_UNSUPPORTED" }
  | { status: "FAILED"; code: "AI_CONFIGURATION_INVALID" | "AI_AUTHENTICATION_FAILED" | "AI_MODEL_UNAVAILABLE" | "AI_RATE_LIMITED" | "AI_MODEL_CHECK_FAILED" | "AI_INFERENCE_FAILED" | "AI_PROBE_TIMEOUT" };
export type AiProbeFetch = typeof fetch;

const probeTimeoutMs = 20_000;
const syntheticPrompt = "Reply with OK.";

function localBase(value?: string) {
  const base = (value ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  try {
    const parsed = new URL(base);
    if (!["http:", "https:"].includes(parsed.protocol) || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) return undefined;
    return base;
  } catch {
    return undefined;
  }
}

function failedResponse(status: number, phase: "model" | "inference"): AiProbeResult {
  if (status === 401 || status === 403) return { status: "FAILED", code: "AI_AUTHENTICATION_FAILED" };
  if (status === 404 || status === 410) return { status: "FAILED", code: "AI_MODEL_UNAVAILABLE" };
  if (status === 429) return { status: "FAILED", code: "AI_RATE_LIMITED" };
  return { status: "FAILED", code: phase === "model" ? "AI_MODEL_CHECK_FAILED" : "AI_INFERENCE_FAILED" };
}

export async function probeAiProvider(config: AiProbeConfig, fetcher: AiProbeFetch = fetch): Promise<AiProbeResult> {
  if (config.provider === "disabled") return { status: "UNSUPPORTED", code: "AI_PROVIDER_DISABLED" };
  if (config.provider !== "ollama") return { status: "UNSUPPORTED", code: "AI_PROVIDER_UNSUPPORTED" };
  const model = config.model?.trim();
  const base = localBase(config.baseUrl);
  if (!model || !base) return { status: "FAILED", code: "AI_CONFIGURATION_INVALID" };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AiProbeResult>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve({ status: "FAILED", code: "AI_PROBE_TIMEOUT" }); }, probeTimeoutMs);
  });
  const headers = { "Content-Type": "application/json", ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) };
  const run = (async (): Promise<AiProbeResult> => {
    let response: Response;
    try { response = await fetcher(`${base}/api/tags`, { method: "GET", headers, signal: controller.signal }); } catch { return controller.signal.aborted ? { status: "FAILED", code: "AI_PROBE_TIMEOUT" } : { status: "FAILED", code: "AI_MODEL_CHECK_FAILED" }; }
    if (!response.ok) return failedResponse(response.status, "model");
    try { response = await fetcher(`${base}/v1/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model, messages: [{ role: "user", content: syntheticPrompt }], max_tokens: 1, temperature: 0 }), signal: controller.signal }); } catch { return controller.signal.aborted ? { status: "FAILED", code: "AI_PROBE_TIMEOUT" } : { status: "FAILED", code: "AI_INFERENCE_FAILED" }; }
    return response.ok ? { status: "PASSED", code: "AI_PROVIDER_MODEL_OK" } : failedResponse(response.status, "inference");
  })();
  const result = await Promise.race([run, timeout]);
  if (timer) clearTimeout(timer);
  return result;
}
