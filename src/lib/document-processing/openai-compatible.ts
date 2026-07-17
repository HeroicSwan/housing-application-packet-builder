import { env } from "@/lib/env";
import { processingResultSchema, type DocumentProcessingInput, type DocumentProcessingResult, type DocumentProcessor } from "./types";
import { extractionPrompt, parseExtractionJson } from "./prompt";
import { extractPdfText, renderPdfToPngDataUrls } from "./pdf-to-images";

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
  renderPdf?: boolean;
};

const fieldAliases: Array<[RegExp, string]> = [
  [/^(name|employee|recipient|applicant|beneficiary|client)$/i, "legal_name"],
  [/^date of birth(?: recorded)?$/i, "date_of_birth"],
  [/^document type$/i, "identification_type"],
  [/^expiration date$/i, "identification_expiration_date"],
  [/^gross monthly income$/i, "gross_monthly_income"],
  [/^monthly benefits income$/i, "monthly_benefits_income"],
  [/^programs?$/i, "benefit_programs"],
  [/^verified on$/i, "homelessness_verification_date"],
  [/^current situation$/i, "current_situation"],
];

function canonicalFieldName(name: string, sourceText: string | null) {
  const sourceLabel = sourceText?.split(":", 1)[0].trim() ?? "";
  return fieldAliases.find(([pattern]) => pattern.test(name.trim()))?.[1]
    ?? fieldAliases.find(([pattern]) => pattern.test(sourceLabel))?.[1]
    ?? name;
}

function valueForLabel(text: string, label: RegExp) {
  const match = text.match(new RegExp(`${label.source}\\s*:\\s*(.*?)(?=\\s+(?:Name|Employee|Recipient|Applicant|Date of birth(?: recorded)?|Document type|Expiration date|Gross monthly income|Monthly benefits income|Programs?|Verified on|Current situation|Statement period)\\s*:|\\s+T\\*|\\s+ET\\s|$)`, "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function fieldsFromLocalPdfText(text: string) {
  const labels: Array<[RegExp, string]> = [
    [/Name|Employee|Recipient|Applicant/, "legal_name"],
    [/Date of birth(?: recorded)?/, "date_of_birth"],
    [/Document type/, "identification_type"],
    [/Expiration date/, "identification_expiration_date"],
    [/Gross monthly income/, "gross_monthly_income"],
    [/Monthly benefits income/, "monthly_benefits_income"],
    [/Programs?/, "benefit_programs"],
    [/Verified on/, "homelessness_verification_date"],
    [/Current situation/, "current_situation"],
  ];
  return labels.flatMap(([label, name]) => {
    const value = valueForLabel(text, label);
    return value ? [{ name, value, confidence: 1, sourcePage: 1, sourceText: `${label.source.replaceAll("(?: recorded)?", "")}: ${value}` }] : [];
  });
}

function normalizeLocalResult(result: DocumentProcessingResult, localPdfText = ""): DocumentProcessingResult {
  const normalizedFields = result.fields.filter((field) => field.value.trim()).map((field) => {
    const sourceValue = field.sourceText?.split(":").slice(1).join(":").trim();
    const name = canonicalFieldName(field.name, field.sourceText);
    let value = name === "legal_name" && sourceValue && sourceValue.length > field.value.length ? sourceValue : field.value;
    const dateMatch = /date|dob|expiration/i.test(name) && value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const longDateMatch = /date|dob|expiration/i.test(name) && value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
    if (dateMatch) value = `${dateMatch[3]}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
    else if (longDateMatch) {
      const parsed = new Date(`${longDateMatch[1]} ${longDateMatch[2]}, ${longDateMatch[3]} UTC`);
      if (!Number.isNaN(parsed.valueOf())) value = parsed.toISOString().slice(0, 10);
    }
    if (/income$/.test(name) && /^[$,\d]+(?:\.\d+)?$/.test(value.trim())) return { ...field, name, value: Number(value.replace(/[$,]/g, "")).toFixed(2) };
    return { ...field, name, value };
  });
  const fields = normalizedFields.filter((field, index) => normalizedFields.findIndex((candidate) => candidate.name === field.name) === index);
  const recovered = fieldsFromLocalPdfText(localPdfText).filter((candidate) => !fields.some((field) => field.name === candidate.name));
  return { ...result, fields: [...fields, ...recovered] };
}

async function contentFor(input: DocumentProcessingInput, renderPdf = false, localPdfText = "") {
  if (input.mimeType === "text/plain" || input.mimeType === "text/csv") return [{ type: "text", text: `Document filename: ${input.filename}\n\n${Buffer.from(input.bytes).toString("utf8")}` }];
  const data = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`;
  if (input.mimeType.startsWith("image/")) return [{ type: "text", text: `Document filename: ${input.filename}` }, { type: "image_url", image_url: { url: data } }];
  if (input.mimeType === "application/pdf" && renderPdf) {
    return [{ type: "text", text: `Document filename: ${input.filename}. The following page images are the locally rendered pages of this PDF. Locally extracted text layer (use only to verify what is visible):\n${localPdfText}` }, ...(await renderPdfToPngDataUrls(input.bytes, input.filename)).map((url) => ({ type: "image_url", image_url: { url } }))];
  }
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
    const localPdfText = input.mimeType === "application/pdf" && this.config.renderPdf ? await extractPdfText(input.bytes).catch(() => "") : "";
    const userContent = await contentFor(input, this.config.renderPdf, localPdfText);
    const localInstruction = this.config.renderPdf ? " Inspect every rendered page and every labeled line. Return only non-empty fields using the exact field names from the schema. For identity documents, explicitly include identification_type and identification_expiration_date." : "";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json", ...this.config.headers },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.1,
          max_tokens: 1800,
          ...(this.config.omitResponseFormat ? {} : { response_format: { type: "json_object" } }),
          messages: [{ role: "system", content: `${extractionPrompt}${localInstruction}` }, { role: "user", content: userContent }],
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
    const result = processingResultSchema.parse(parseExtractionJson(text));
    return this.config.renderPdf ? normalizeLocalResult(result, localPdfText) : result;
  }
}
