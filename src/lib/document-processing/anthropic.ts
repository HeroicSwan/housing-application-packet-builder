import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { processingResultSchema, type DocumentProcessingInput, type DocumentProcessor } from "./types";
import { extractionPrompt, parseExtractionJson } from "./prompt";

export class AnthropicDocumentProcessor implements DocumentProcessor {
  async processDocument(input: DocumentProcessingInput) {
    if (!env.ANTHROPIC_API_KEY) throw new Error("Anthropic processing is enabled but ANTHROPIC_API_KEY is missing.");
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const encoded = Buffer.from(input.bytes).toString("base64");
    const source = input.mimeType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: encoded } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: input.mimeType as "image/jpeg" | "image/png", data: encoded } };
    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL, max_tokens: 1800,
      messages: [{ role: "user", content: [
        { type: "text", text: extractionPrompt },
        source,
      ] }],
    });
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") throw new Error("Document processor returned no structured text.");
    return processingResultSchema.parse(parseExtractionJson(text.text));
  }
}
