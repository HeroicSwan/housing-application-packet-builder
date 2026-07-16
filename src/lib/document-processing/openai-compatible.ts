import { env } from "@/lib/env";
import { processingResultSchema, type DocumentProcessingInput, type DocumentProcessor } from "./types";
import { extractionPrompt, parseExtractionJson } from "./prompt";

type CompatibleConfig = {
  name: string;
  apiKey: string | undefined;
  model: string;
  endpoint: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  /** Header used to send the API key. Defaults to `Authorization` with a `Bearer` prefix (e.g. Azure uses `api-key`). */
  apiKeyHeader?: string;
  /** Providers such as local Ollama or keyless self-hosted gateways may run without an API key. */
  requiresApiKey?: boolean;
  /** Some providers reject `response_format`; the extraction prompt still demands JSON and parsing tolerates prose wrappers. */
  omitResponseFormat?: boolean;
};

function contentFor(input: DocumentProcessingInput) {
  if (input.mimeType === "text/plain" || input.mimeType === "text/csv") return [{ type: "text", text: `Document filename: ${input.filename}\n\n${Buffer.from(input.bytes).toString("utf8")}` }];
  const data = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`;
  if (input.mimeType.startsWith("image/")) return [{ type: "text", text: `Document filename: ${input.filename}` }, { type: "image_url", image_url: { url: data } }];
  if (input.mimeType === "application/pdf") return [{ type: "text", text: `Document filename: ${input.filename}. This provider adapter accepts PDF bytes only when the selected model supports PDF/file inputs. If it does not, return a warning rather than inventing values.` }, { type: "file", file: { filename: input.filename, file_data: data } }];
  return [{ type: "text", text: `Document filename: ${input.filename}\nBinary document type: ${input.mimeType}. Return warnings if the model cannot inspect it.` }];
}

export class OpenAICompatibleDocumentProcessor implements DocumentProcessor {
  constructor(private readonly config: CompatibleConfig) {}

  private authHeaders(): Record<string, string> {
    if (!this.config.apiKey) return {};
    if (this.config.apiKeyHeader && this.config.apiKeyHeader.toLowerCase() !== "authorization") return { [this.config.apiKeyHeader]: this.config.apiKey };
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  async processDocument(input: DocumentProcessingInput) {
    if (!this.config.apiKey && (this.config.requiresApiKey ?? true)) throw new Error(`${this.config.name} processing is enabled but its API key is missing.`);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json", ...this.config.headers },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.1,
          max_tokens: 1800,
          ...(this.config.omitResponseFormat ? {} : { response_format: { type: "json_object" } }),
          messages: [{ role: "system", content: extractionPrompt }, { role: "user", content: contentFor(input) }],
          ...this.config.body,
        }),
        signal: AbortSignal.timeout(env.DOCUMENT_PROCESSOR_TIMEOUT_MS),
      });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 60000) : Math.min(1000 * (2 ** attempt), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (!response) throw new Error(`${this.config.name} document processor did not return a response.`);
    const responseText = await response.text();
    if (!response.ok) throw new Error(`${this.config.name} document processor returned HTTP ${response.status}.`);
    const payload = JSON.parse(responseText) as { choices?: { message?: { content?: string | { text?: string }[] } }[] };
    const content = payload.choices?.[0]?.message?.content;
    const text = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content;
    if (!text) throw new Error(`${this.config.name} document processor returned no structured text.`);
    return processingResultSchema.parse(parseExtractionJson(text));
  }
}
