import "server-only";

export type AiProbeProvider =
  | "disabled"
  | "anthropic"
  | "gemini"
  | "groq"
  | "openrouter"
  | "sambanova"
  | "cerebras"
  | "mistral"
  | "openai"
  | "azure-openai"
  | "xai"
  | "deepseek"
  | "together"
  | "fireworks"
  | "cohere"
  | "perplexity"
  | "ollama"
  | "custom";

export type AiProbeConfig = {
  provider: AiProbeProvider;
  model?: string;
  apiKey?: string;
  httpReferer?: string;
  appTitle?: string;
};

export type AiProbeResult =
  | { status: "PASSED"; code: "AI_PROVIDER_MODEL_OK" }
  | { status: "UNSUPPORTED"; code: "AI_PROVIDER_DISABLED" | "AI_PROVIDER_UNSUPPORTED" }
  | { status: "FAILED"; code: "AI_CONFIGURATION_INVALID" | "AI_AUTHENTICATION_FAILED" | "AI_MODEL_UNAVAILABLE" | "AI_RATE_LIMITED" | "AI_MODEL_CHECK_FAILED" | "AI_INFERENCE_FAILED" | "AI_PROBE_TIMEOUT" };

export type AiProbeFetch = typeof fetch;

type EnabledProvider = Exclude<AiProbeProvider, "disabled">;
type ReadyConfig = AiProbeConfig & { provider: EnabledProvider; model: string; apiKey: string };
type ProbeRequest = { url: string; init: RequestInit };

const probeTimeoutMs = 20_000;
const syntheticPrompt = "Reply with OK.";
// Two-step probes: a GET model lookup, then a one-token inference call.
const openAiCompatibleBases: Partial<Record<EnabledProvider, string>> = {
  groq: "https://api.groq.com/openai/v1",
  sambanova: "https://api.sambanova.ai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  mistral: "https://api.mistral.ai/v1",
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
};
// Inference-only probes: these vendors do not expose a reliable per-model GET,
// so the probe validates the key and model with a single one-token completion.
const inferenceOnlyBases: Partial<Record<EnabledProvider, string>> = {
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  cohere: "https://api.cohere.ai/compatibility/v1",
  perplexity: "https://api.perplexity.ai",
};
// azure-openai, ollama, and custom endpoints are deployment-configured through
// environment variables, so the wizard reports them as UNSUPPORTED instead of
// simulating a pass; they are verified at runtime against the real endpoint.

function bearerHeaders(config: ReadyConfig) {
  return { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" };
}

function encodeModel(model: string) {
  return encodeURIComponent(model);
}

function buildRequests(config: ReadyConfig): [ProbeRequest | null, ProbeRequest] {
  const inferenceOnlyBase = inferenceOnlyBases[config.provider];
  if (inferenceOnlyBase) {
    return [
      null,
      { url: `${inferenceOnlyBase}/chat/completions`, init: { method: "POST", headers: bearerHeaders(config), body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: syntheticPrompt }], max_tokens: 1, temperature: 0 }) } },
    ];
  }

  if (config.provider === "anthropic") {
    const headers = { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
    return [
      { url: `https://api.anthropic.com/v1/models/${encodeModel(config.model)}`, init: { method: "GET", headers } },
      { url: "https://api.anthropic.com/v1/messages", init: { method: "POST", headers, body: JSON.stringify({ model: config.model, max_tokens: 1, messages: [{ role: "user", content: syntheticPrompt }] }) } },
    ];
  }

  if (config.provider === "gemini") {
    const headers = { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" };
    const model = encodeModel(config.model);
    return [
      { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}`, init: { method: "GET", headers } },
      { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, init: { method: "POST", headers, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: syntheticPrompt }] }], generationConfig: { maxOutputTokens: 1, temperature: 0 } }) } },
    ];
  }

  if (config.provider === "openrouter") {
    const headers = {
      ...bearerHeaders(config),
      ...(config.httpReferer ? { "HTTP-Referer": config.httpReferer } : {}),
      ...(config.appTitle ? { "X-OpenRouter-Title": config.appTitle } : {}),
    };
    const modelPath = config.model.split("/").map(encodeURIComponent).join("/");
    return [
      { url: `https://openrouter.ai/api/v1/model/${modelPath}`, init: { method: "GET", headers } },
      { url: "https://openrouter.ai/api/v1/chat/completions", init: { method: "POST", headers, body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: syntheticPrompt }], max_tokens: 1, temperature: 0, provider: { zdr: true } }) } },
    ];
  }

  // probeAiProvider only reaches this fallthrough for providers present in openAiCompatibleBases.
  const base = openAiCompatibleBases[config.provider]!;
  const headers = bearerHeaders(config);
  return [
    { url: `${base}/models/${encodeModel(config.model)}`, init: { method: "GET", headers } },
    { url: `${base}/chat/completions`, init: { method: "POST", headers, body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: syntheticPrompt }], max_tokens: 1, temperature: 0 }) } },
  ];
}

function failedResponse(status: number, phase: "model" | "inference"): AiProbeResult {
  if (status === 401 || status === 403) return { status: "FAILED", code: "AI_AUTHENTICATION_FAILED" };
  if (status === 404 || status === 410) return { status: "FAILED", code: "AI_MODEL_UNAVAILABLE" };
  if (status === 429) return { status: "FAILED", code: "AI_RATE_LIMITED" };
  return { status: "FAILED", code: phase === "model" ? "AI_MODEL_CHECK_FAILED" : "AI_INFERENCE_FAILED" };
}

async function runProbe(config: ReadyConfig, fetcher: AiProbeFetch, signal: AbortSignal): Promise<AiProbeResult> {
  const [modelRequest, inferenceRequest] = buildRequests(config);
  let response: Response;
  if (modelRequest) {
    try {
      response = await fetcher(modelRequest.url, { ...modelRequest.init, signal });
    } catch {
      return signal.aborted ? { status: "FAILED", code: "AI_PROBE_TIMEOUT" } : { status: "FAILED", code: "AI_MODEL_CHECK_FAILED" };
    }
    if (!response.ok) return failedResponse(response.status, "model");
  }

  try {
    response = await fetcher(inferenceRequest.url, { ...inferenceRequest.init, signal });
  } catch {
    return signal.aborted ? { status: "FAILED", code: "AI_PROBE_TIMEOUT" } : { status: "FAILED", code: "AI_INFERENCE_FAILED" };
  }
  if (!response.ok) return failedResponse(response.status, "inference");
  return { status: "PASSED", code: "AI_PROVIDER_MODEL_OK" };
}

export async function probeAiProvider(config: AiProbeConfig, fetcher: AiProbeFetch = fetch): Promise<AiProbeResult> {
  if (config.provider === "disabled") return { status: "UNSUPPORTED", code: "AI_PROVIDER_DISABLED" };
  if (!(config.provider in openAiCompatibleBases) && !(config.provider in inferenceOnlyBases) && !["anthropic", "gemini", "openrouter"].includes(config.provider)) return { status: "UNSUPPORTED", code: "AI_PROVIDER_UNSUPPORTED" };
  const model = config.model?.trim();
  const apiKey = config.apiKey?.trim();
  if (!model || !apiKey) return { status: "FAILED", code: "AI_CONFIGURATION_INVALID" };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AiProbeResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: "FAILED", code: "AI_PROBE_TIMEOUT" });
    }, probeTimeoutMs);
  });
  const result = await Promise.race([runProbe({ ...config, provider: config.provider, model, apiKey } as ReadyConfig, fetcher, controller.signal), timeout]);
  if (timer) clearTimeout(timer);
  return result;
}
