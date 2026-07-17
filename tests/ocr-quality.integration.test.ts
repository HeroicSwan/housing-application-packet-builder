import fs from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { getDocumentProcessor } from "@/lib/document-processing";

const enabled = process.env.RUN_OCR_EVAL === "true" && env.DOCUMENT_PROCESSOR !== "mock";
const corpus = [
  { file: "jordan-state-identification.pdf", category: "IDENTITY", expected: { legal_name: "Jordan Rivera", date_of_birth: "1990-05-08", identification_expiration_date: "2025-04-30" } },
  { file: "jordan-income-statement.pdf", category: "INCOME", expected: { legal_name: "Jordan Rivera", gross_monthly_income: "1450.00" } },
  { file: "jordan-benefits-award.pdf", category: "BENEFITS", expected: { legal_name: "Jordan Rivera", date_of_birth: "1990-05-09", monthly_benefits_income: "620.00" } },
  { file: "jordan-homelessness-verification.pdf", category: "HOMELESSNESS_VERIFICATION", expected: { legal_name: "Jordan Rivera", homelessness_verification_date: "2026-06-25" } },
] as const;

function normalized(value: string) {
  return value.toLowerCase().replace(/[$,\s.]/g, "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1$2$3");
}

describe.skipIf(!enabled)("OCR/document extraction quality gate", () => {
  it("extracts the adversarial synthetic corpus with sourced values and preserves a deliberate date conflict", async () => {
    const processor = getDocumentProcessor();
    let expectedValues = 0; let matchedValues = 0; let sourcedValues = 0;
    const results = [];
    for (const item of corpus) {
      const result = await processor.processDocument({ filename: item.file, mimeType: "application/pdf", bytes: await fs.readFile(`fixtures/${item.file}`), category: item.category, dataClass: "SYNTHETIC" });
      const fields = new Map(result.fields.map((field) => [field.name, field]));
      for (const [name, value] of Object.entries(item.expected)) {
        expectedValues += 1;
        const field = fields.get(name);
        if (field && normalized(field.value) === normalized(value)) matchedValues += 1;
        if (field?.sourcePage && field.sourceText) sourcedValues += 1;
      }
      results.push({ file: item.file, expected: Object.keys(item.expected).length, returned: result.fields.length, warnings: result.warnings.length, fields: result.fields });
    }
    const exactRecall = matchedValues / expectedValues;
    const sourceCoverage = sourcedValues / expectedValues;
    await mkdir("output/evaluations", { recursive: true });
    await writeFile(`output/evaluations/ocr-${env.DOCUMENT_PROCESSOR}.json`, JSON.stringify({ syntheticOnly: true, provider: env.DOCUMENT_PROCESSOR, expectedValues, matchedValues, exactRecall, sourceCoverage, deliberateConflict: "1990-05-08 vs 1990-05-09", results }, null, 2));
    expect(exactRecall).toBeGreaterThanOrEqual(0.8);
    expect(sourceCoverage).toBe(1);
  }, 240_000);
});
