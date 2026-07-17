import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { env } from "@/lib/env";
import { getDocumentProcessor } from "@/lib/document-processing";

const enabled = process.env.RUN_PROVIDER_AI_SMOKE === "true";

(enabled ? it : it.skip)("runs three synthetic extraction requests through the configured AI provider", async () => {
  const processor = getDocumentProcessor();
  const started = performance.now();
  const results = [];
  for (let index = 1; index <= 3; index += 1) {
    const text = [`Applicant legal name: AI Smoke Applicant ${index}`, `Date of birth: 198${index}-0${index}-1${index}`, `Phone: 555-019-${String(index).padStart(4, "0")}`, `Email: ai-smoke-${index}@example.test`, `Gross monthly income: ${1900 + index * 25}.00`, "Benefit programs: SNAP"].join("\n");
    const result = await processor.processDocument({ filename: `ai-smoke-${index}.txt`, mimeType: "text/plain", bytes: new TextEncoder().encode(text), category: "IDENTITY", dataClass: "SYNTHETIC" });
    expect(result.fields.length).toBeGreaterThan(0);
    results.push({ fields: result.fields.length, warnings: result.warnings.length, category: result.category });
  }
  const model = env.DOCUMENT_PROCESSOR === "ollama" ? env.OLLAMA_MODEL : env.DOCUMENT_PROCESSOR;
  await mkdir("output/stress", { recursive: true });
  await writeFile(`output/stress/ai-smoke-${env.DOCUMENT_PROCESSOR}.json`, JSON.stringify({ provider: env.DOCUMENT_PROCESSOR, model, attempts: results.length, successful: results.length, totalFields: results.reduce((sum, result) => sum + result.fields, 0), totalWarnings: results.reduce((sum, result) => sum + result.warnings, 0), elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)) }, null, 2));
}, 180000);
