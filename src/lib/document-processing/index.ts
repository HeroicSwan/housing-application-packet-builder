import { env } from "@/lib/env";
import { AnthropicDocumentProcessor } from "./anthropic";
import { MockDocumentProcessor } from "./mock";
import { GeminiDocumentProcessor } from "./gemini";
import { OpenAICompatibleDocumentProcessor } from "./openai-compatible";

export function getDocumentProcessor() {
  if (env.DOCUMENT_PROCESSOR === "anthropic") return new AnthropicDocumentProcessor();
  if (env.DOCUMENT_PROCESSOR === "gemini") return new GeminiDocumentProcessor();
  const compatible: Record<string, ConstructorParameters<typeof OpenAICompatibleDocumentProcessor>[0]> = {
    groq: { name: "Groq", apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, endpoint: "https://api.groq.com/openai/v1/chat/completions" },
    openrouter: { name: "OpenRouter", apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL, endpoint: "https://openrouter.ai/api/v1/chat/completions", headers: { ...(env.OPENROUTER_HTTP_REFERER ? { "HTTP-Referer": env.OPENROUTER_HTTP_REFERER } : {}), "X-OpenRouter-Title": env.OPENROUTER_APP_TITLE } },
    sambanova: { name: "SambaNova Cloud", apiKey: env.SAMBANOVA_API_KEY, model: env.SAMBANOVA_MODEL, endpoint: "https://api.sambanova.ai/v1/chat/completions" },
    cerebras: { name: "Cerebras Inference", apiKey: env.CEREBRAS_API_KEY, model: env.CEREBRAS_MODEL, endpoint: "https://api.cerebras.ai/v1/chat/completions" },
    mistral: { name: "Mistral", apiKey: env.MISTRAL_API_KEY, model: env.MISTRAL_MODEL, endpoint: "https://api.mistral.ai/v1/chat/completions" },
  };
  return compatible[env.DOCUMENT_PROCESSOR] ? new OpenAICompatibleDocumentProcessor(compatible[env.DOCUMENT_PROCESSOR]) : new MockDocumentProcessor();
}

export * from "./types";
