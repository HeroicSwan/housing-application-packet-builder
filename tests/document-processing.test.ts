import { describe, expect, it } from "vitest";
import { MockDocumentProcessor } from "@/lib/document-processing/mock";
import { processingResultSchema } from "@/lib/document-processing/types";

describe("mock extraction behavior", () => {
  it("produces predictable, sourced identity fields", async () => { const result = await new MockDocumentProcessor().processDocument({ filename: "sample-id.pdf", mimeType: "application/pdf", bytes: new Uint8Array() }); expect(result.category).toBe("IDENTITY"); expect(result.fields.find((field) => field.name === "legal_name")).toMatchObject({ value: "Jordan A. Lee", sourcePage: 1 }); });
  it("returns a review warning for unmatched files", async () => { const result = await new MockDocumentProcessor().processDocument({ filename: "unknown.pdf", mimeType: "application/pdf", bytes: new Uint8Array(), category: "OTHER" }); expect(result.warnings).toHaveLength(1); expect(result.fields[0].confidence).toBeLessThan(0.7); });
  it("rejects malformed provider output", () => expect(() => processingResultSchema.parse({ category: "IDENTITY", expirationDate: null, fields: [{ name: "legal_name", value: "Synthetic", confidence: 4, sourcePage: 1, sourceText: null }], warnings: [] })).toThrow());
});
