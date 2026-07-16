import { env } from "@/lib/env";
import { AnthropicDocumentProcessor } from "./anthropic";
import { DisabledDocumentProcessor } from "./disabled";
import { MockDocumentProcessor } from "./mock";
import { GeminiDocumentProcessor } from "./gemini";
import { OpenAICompatibleDocumentProcessor } from "./openai-compatible";

type CompatibleConfig = ConstructorParameters<typeof OpenAICompatibleDocumentProcessor>[0];

function azureEndpoint() {
  const base = (env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
  return `${base}/openai/deployments/${encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT ?? "")}/chat/completions?api-version=${encodeURIComponent(env.AZURE_OPENAI_API_VERSION)}`;
}

function customEndpoint() {
  return `${(env.CUSTOM_OPENAI_BASE_URL ?? "").replace(/\/+$/, "")}/chat/completions`;
}

function ollamaEndpoint() {
  return `${env.OLLAMA_BASE_URL.replace(/\/+$/, "")}/v1/chat/completions`;
}

export function getDocumentProcessor() {
  if (env.DOCUMENT_PROCESSOR === "disabled") return new DisabledDocumentProcessor();
  if (env.DOCUMENT_PROCESSOR === "anthropic") return new AnthropicDocumentProcessor();
  if (env.DOCUMENT_PROCESSOR === "gemini") return new GeminiDocumentProcessor();
  const compatible: Record<string, CompatibleConfig> = {
    openai: { name: "OpenAI", apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, endpoint: "https://api.openai.com/v1/chat/completions" },
    "azure-openai": { name: "Azure OpenAI", apiKey: env.AZURE_OPENAI_API_KEY, model: env.AZURE_OPENAI_DEPLOYMENT ?? "", endpoint: azureEndpoint(), apiKeyHeader: "api-key" },
    groq: { name: "Groq", apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, endpoint: "https://api.groq.com/openai/v1/chat/completions" },
    openrouter: { name: "OpenRouter", apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL, endpoint: "https://openrouter.ai/api/v1/chat/completions", headers: { ...(env.OPENROUTER_HTTP_REFERER ? { "HTTP-Referer": env.OPENROUTER_HTTP_REFERER } : {}), "X-OpenRouter-Title": env.OPENROUTER_APP_TITLE }, body: { provider: { zdr: true } } },
    sambanova: { name: "SambaNova Cloud", apiKey: env.SAMBANOVA_API_KEY, model: env.SAMBANOVA_MODEL, endpoint: "https://api.sambanova.ai/v1/chat/completions" },
    cerebras: { name: "Cerebras Inference", apiKey: env.CEREBRAS_API_KEY, model: env.CEREBRAS_MODEL, endpoint: "https://api.cerebras.ai/v1/chat/completions" },
    mistral: { name: "Mistral", apiKey: env.MISTRAL_API_KEY, model: env.MISTRAL_MODEL, endpoint: "https://api.mistral.ai/v1/chat/completions" },
    xai: { name: "xAI", apiKey: env.XAI_API_KEY, model: env.XAI_MODEL, endpoint: "https://api.x.ai/v1/chat/completions" },
    deepseek: { name: "DeepSeek", apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL, endpoint: "https://api.deepseek.com/v1/chat/completions" },
    together: { name: "Together AI", apiKey: env.TOGETHER_API_KEY, model: env.TOGETHER_MODEL, endpoint: "https://api.together.xyz/v1/chat/completions" },
    fireworks: { name: "Fireworks AI", apiKey: env.FIREWORKS_API_KEY, model: env.FIREWORKS_MODEL, endpoint: "https://api.fireworks.ai/inference/v1/chat/completions" },
    cohere: { name: "Cohere", apiKey: env.COHERE_API_KEY, model: env.COHERE_MODEL, endpoint: "https://api.cohere.ai/compatibility/v1/chat/completions" },
    perplexity: { name: "Perplexity", apiKey: env.PERPLEXITY_API_KEY, model: env.PERPLEXITY_MODEL, endpoint: "https://api.perplexity.ai/chat/completions", omitResponseFormat: true },
    ollama: { name: "Ollama (local)", apiKey: env.OLLAMA_API_KEY, model: env.OLLAMA_MODEL, endpoint: ollamaEndpoint(), requiresApiKey: false },
    custom: { name: env.CUSTOM_OPENAI_PROVIDER_NAME, apiKey: env.CUSTOM_OPENAI_API_KEY, model: env.CUSTOM_OPENAI_MODEL ?? "", endpoint: customEndpoint(), requiresApiKey: false, omitResponseFormat: true },
  };
  return compatible[env.DOCUMENT_PROCESSOR] ? new OpenAICompatibleDocumentProcessor(compatible[env.DOCUMENT_PROCESSOR]) : new MockDocumentProcessor();
}

export * from "./types";
