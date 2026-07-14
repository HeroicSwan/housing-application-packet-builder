import { env } from "@/lib/env";
import { processingResultSchema, type DocumentProcessingInput, type DocumentProcessor } from "./types";
import { extractionPrompt, parseExtractionJson } from "./prompt";

export class GeminiDocumentProcessor implements DocumentProcessor {
  async processDocument(input: DocumentProcessingInput) {
    if (!env.GEMINI_API_KEY) throw new Error("Gemini processing is enabled but GEMINI_API_KEY is missing.");
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = input.mimeType === "text/plain" || input.mimeType === "text/csv"
      ? [{ text: `Document filename: ${input.filename}\n\n${Buffer.from(input.bytes).toString("utf8")}` }]
      : [{ inlineData: { mimeType: input.mimeType, data: Buffer.from(input.bytes).toString("base64") } }];
    parts.unshift({ text: extractionPrompt });
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 1800, responseMimeType: "application/json" } }), signal: AbortSignal.timeout(env.DOCUMENT_PROCESSOR_TIMEOUT_MS) });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Gemini document processor returned HTTP ${response.status}.`);
    const payload = JSON.parse(responseText) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) throw new Error("Gemini document processor returned no structured text.");
    return processingResultSchema.parse(parseExtractionJson(text));
  }
}
