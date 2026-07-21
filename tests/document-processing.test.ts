import { describe, expect, it } from "vitest";
import { MockDocumentProcessor } from "@/lib/document-processing/mock";
import { processingResultSchema } from "@/lib/document-processing/types";
import { enforceExtractionQuality, minimumFieldConfidence } from "@/lib/document-processing/quality";
import { parseClassificationJson } from "@/lib/document-processing/prompt";

describe("mock extraction behavior", () => {
  it("produces predictable, sourced identity fields", async () => { const result = await new MockDocumentProcessor().processDocument({ filename: "sample-id.pdf", mimeType: "application/pdf", bytes: new Uint8Array() }); expect(result.category).toBe("IDENTITY"); expect(result.fields.find((field) => field.name === "legal_name")).toMatchObject({ value: "Jordan A. Lee", sourcePage: 1 }); });
  it("returns a review warning for unmatched files", async () => { const result = await new MockDocumentProcessor().processDocument({ filename: "unknown.pdf", mimeType: "application/pdf", bytes: new Uint8Array(), category: "OTHER" }); expect(result.warnings).toHaveLength(1); expect(result.fields[0].confidence).toBeLessThan(0.7); });
  it("rejects malformed provider output", () => expect(() => processingResultSchema.parse({ category: "IDENTITY", expirationDate: null, fields: [{ name: "legal_name", value: "Synthetic", confidence: 4, sourcePage: 1, sourceText: null }], warnings: [] })).toThrow());
  it("abstains from low-confidence or ungrounded values", () => {
    const result = enforceExtractionQuality({ category: "IDENTITY", expirationDate: null, fields: [
      { name: "legal_name", value: "Guessed", confidence: minimumFieldConfidence - 0.01, sourcePage: 1, sourceText: "Name: Guessed" },
      { name: "date_of_birth", value: "1990-01-01", confidence: 0.99, sourcePage: null, sourceText: null },
      { name: "identification_type", value: "State ID", confidence: 0.99, sourcePage: 1, sourceText: "Document type: State ID" },
    ], warnings: [] });
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].name).toBe("identification_type");
    expect(result.warnings).toHaveLength(2);
  });
  it("parses page classifications into a bounded confidence result", () => {
    expect(parseClassificationJson('{"pages":[{"page":1,"category":"INCOME","confidence":82,"reason":"Paystub headings are visible"}],"warnings":[]}')).toEqual({ pages: [{ page: 1, category: "INCOME", confidence: 0.82, reason: "Paystub headings are visible" }], warnings: [] });
  });
});
