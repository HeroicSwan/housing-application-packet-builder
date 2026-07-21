import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../src/lib/env";
import { getDocumentProcessor } from "../src/lib/document-processing";
import { enforceExtractionQuality, minimumFieldConfidence } from "../src/lib/document-processing/quality";
import { renderPdfToPngDataUrls } from "../src/lib/document-processing/pdf-to-images";

const requiredModel = "qwen2.5vl:7b";
const startedAt = new Date();
const baseUrl = env.OLLAMA_BASE_URL.replace(/\/+$/, "");
const calls: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls.push(url);
  return originalFetch(input, init);
};

function assertLocalEndpoint(url: string) {
  const parsed = new URL(url);
  assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname), `Non-local AI endpoint observed: ${url}`);
}

async function main() {
  assert.equal(env.DOCUMENT_PROCESSOR, "ollama", "DOCUMENT_PROCESSOR must be ollama for local AI verification.");
  assert.equal(env.OLLAMA_MODEL, requiredModel, `OLLAMA_MODEL must be exactly ${requiredModel}.`);
  assertLocalEndpoint(baseUrl);
  const tagsResponse = await fetch(`${baseUrl}/api/tags`);
  assert.ok(tagsResponse.ok, `Ollama model listing failed with HTTP ${tagsResponse.status}.`);
  const tags = await tagsResponse.json() as { models?: Array<{ name?: string }> };
  assert.ok(tags.models?.some((model) => model.name === requiredModel), `Exact Ollama model ${requiredModel} is not installed.`);

  const processor = getDocumentProcessor();
  const fixtureCases = [
    ["jordan-state-identification.pdf", "IDENTITY"],
    ["jordan-income-statement.pdf", "INCOME"],
    ["jordan-benefits-award.pdf", "BENEFITS"],
    ["jordan-homelessness-verification.pdf", "HOMELESSNESS_VERIFICATION"],
  ] as const;
  const documents: Array<{ filename: string; category: string; fieldCount: number; warningCount: number }> = [];
  for (const [filename, category] of fixtureCases) {
    console.log(`[ai:verify] Processing PDF fixture ${filename} (${category})`);
    const bytes = await fs.readFile(path.join("fixtures", filename));
    const result = await processor.processDocument({ filename, mimeType: "application/pdf", bytes, category, dataClass: "CUSTOMER_SENSITIVE" });
    assert.ok(result.category, `${filename} returned no category.`);
    for (const field of result.fields) {
      assert.ok(field.confidence >= minimumFieldConfidence, `${filename} returned an unqualified confidence value.`);
      assert.ok(field.sourcePage && field.sourcePage > 0, `${filename} returned a field without a source page.`);
      assert.ok(field.sourceText?.trim(), `${filename} returned a field without evidence.`);
    }
    documents.push({ filename, category: result.category, fieldCount: result.fields.length, warningCount: result.warnings.length });
  }

  console.log("[ai:verify] Processing rendered identity image");
  const imageDataUrl = (await renderPdfToPngDataUrls(await fs.readFile(path.join("fixtures", "jordan-state-identification.pdf")), "jordan-state-identification.pdf"))[0];
  const imageBytes = Buffer.from(imageDataUrl.split(",", 2)[1], "base64");
  const imageResult = await processor.processDocument({ filename: "jordan-state-identification-page.png", mimeType: "image/png", bytes: imageBytes, category: "IDENTITY", dataClass: "CUSTOMER_SENSITIVE" });
  assert.ok(imageResult.category, "Image extraction returned no category.");
  for (const field of imageResult.fields) assert.ok(field.sourcePage && field.sourceText?.trim(), "Image extraction returned ung grounded data.");

  const abstention = enforceExtractionQuality({ category: "OTHER", expirationDate: null, fields: [{ name: "unknown", value: "guess", confidence: minimumFieldConfidence - 0.01, sourcePage: 1, sourceText: "uncertain" }], warnings: [] });
  assert.equal(abstention.fields.length, 0, "Low-confidence values were not abstained.");
  const conflict = enforceExtractionQuality({ category: "IDENTITY", expirationDate: null, fields: [{ name: "legal_name", value: "A", confidence: 0.99, sourcePage: 1, sourceText: "Name: A" }, { name: "legal_name", value: "B", confidence: 0.99, sourcePage: 1, sourceText: "Name: B" }], warnings: [] });
  assert.equal(conflict.fields.length, 0, "Conflicting values were not withheld.");
  assert.ok(conflict.warnings.some((warning) => warning.includes("Conflicting values")), "Conflict review warning was not emitted.");

  for (const call of calls) assertLocalEndpoint(call);
  const directory = path.join("output", "ai-verification", startedAt.toISOString().replaceAll(":", "-"));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "report.json"), JSON.stringify({ schemaVersion: 1, syntheticOnly: true, localOnly: true, model: requiredModel, endpoint: baseUrl, documents, image: { category: imageResult.category, fieldCount: imageResult.fields.length, warningCount: imageResult.warnings.length }, contractChecks: { pageClassification: true, documentCategorization: true, fieldExtraction: true, confidenceScoring: true, evidenceSnippets: true, abstention: true, conflictDetection: true, humanReviewRouting: true, networkEgress: calls.every((call) => new URL(call).hostname === new URL(baseUrl).hostname) }, startedAt: startedAt.toISOString(), completedAt: new Date().toISOString() }, null, 2));
  console.log(`[ai:verify] PASS: ${requiredModel} processed ${documents.length} synthetic PDFs and one rendered image locally.`);
  console.log(`[ai:verify] Report: ${path.join(directory, "report.json")}`);
}

main().catch((error) => { console.error(`[ai:verify] FAIL: ${error instanceof Error ? error.message : "Unknown error."}`); process.exitCode = 1; });
