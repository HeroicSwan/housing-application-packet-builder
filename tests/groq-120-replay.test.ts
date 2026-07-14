import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { env } from "@/lib/env";
import { getDocumentProcessor } from "@/lib/document-processing";

const runGroqReplay = process.env.RUN_GROQ_120 === "true" && env.DOCUMENT_PROCESSOR === "groq";

(runGroqReplay ? it : it.skip)("processes 120 synthetic applicants through the configured Groq extraction API", async () => {
  const processor = getDocumentProcessor();
  const started = performance.now();
  const results: { index: number; fields: number; warnings: number; category: string }[] = [];
  for (let index = 1; index <= 120; index += 1) {
      const text = [
        `Applicant legal name: Synthetic Applicant ${index}`,
        `Date of birth: 198${index % 10}-0${(index % 9) + 1}-1${index % 9}`,
        `Phone: 555-010-${String(index).padStart(4, "0")}`,
        `Email: synthetic-${index}@example.test`,
        `Mailing address: ${index} Synthetic Way, Testville, NY 10001`,
        `Household size: ${(index % 7) + 1}`,
        `Gross monthly income: ${1800 + index * 7}.00`,
        `Benefit programs: SNAP; Medicaid`,
      ].join("\n");
      const result = await processor.processDocument({ filename: `synthetic-applicant-${index}.txt`, mimeType: "text/plain", bytes: new TextEncoder().encode(text), category: "SYNTHETIC_APPLICATION" });
      results.push({ index, fields: result.fields.length, warnings: result.warnings.length, category: result.category });
      await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  expect(results).toHaveLength(120);
  expect(results.every((result) => result.fields > 0)).toBe(true);
  expect(results.every((result) => result.category.length > 0)).toBe(true);
  await mkdir("output/stress", { recursive: true });
  await writeFile("output/stress/groq-120-replay.json", JSON.stringify({ provider: "groq", model: env.GROQ_MODEL, applicants: results.length, successful: results.length, totalFields: results.reduce((sum, result) => sum + result.fields, 0), totalWarnings: results.reduce((sum, result) => sum + result.warnings, 0), elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)) }, null, 2));
}, 600000);
