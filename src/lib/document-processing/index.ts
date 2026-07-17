import { env } from "@/lib/env";
import { DisabledDocumentProcessor } from "./disabled";
import { MockDocumentProcessor } from "./mock";
import { OpenAICompatibleDocumentProcessor } from "./openai-compatible";
import { CustomerDataPolicyProcessor } from "./policy";

type CompatibleConfig = ConstructorParameters<typeof OpenAICompatibleDocumentProcessor>[0];

function ollamaEndpoint() {
  return `${env.OLLAMA_BASE_URL.replace(/\/+$/, "")}/v1/chat/completions`;
}

export function getDocumentProcessor() {
  if (env.DOCUMENT_PROCESSOR === "disabled") return new DisabledDocumentProcessor();
  const compatible: Record<string, CompatibleConfig> = {
    ollama: { name: "Ollama (local)", apiKey: env.OLLAMA_API_KEY, model: env.OLLAMA_MODEL, endpoint: ollamaEndpoint(), requiresApiKey: false, renderPdf: true, body: { keep_alive: "10m", options: { num_predict: 800 } } },
  };
  const config = compatible[env.DOCUMENT_PROCESSOR];
  if (config) return new CustomerDataPolicyProcessor(new OpenAICompatibleDocumentProcessor(config), env.DOCUMENT_PROCESSOR);
  if (env.DOCUMENT_PROCESSOR === "mock") return new MockDocumentProcessor();
  throw new Error(`AI provider ${env.DOCUMENT_PROCESSOR} has been retired because its data-use or downstream-provider policy is not approved for this application.`);
}

export * from "./types";
