import type { DocumentProcessingInput, DocumentProcessingResult, DocumentProcessor } from "./types";

const fixtures: Record<string, Omit<DocumentProcessingResult, "warnings">> = {
  "sample-id": { category: "IDENTITY", expirationDate: "2028-09-30", fields: [
    { name: "legal_name", value: "Jordan A. Lee", confidence: 0.98, sourcePage: 1, sourceText: "Name: Jordan A. Lee" },
    { name: "date_of_birth", value: "1988-06-14", confidence: 0.96, sourcePage: 1, sourceText: "DOB: 06/14/1988" },
    { name: "document_number", value: "D000-482-91", confidence: 0.91, sourcePage: 1, sourceText: "ID No. D000-482-91" },
  ] },
  "sample-income": { category: "INCOME", expirationDate: null, fields: [
    { name: "legal_name", value: "Jordan A. Lee", confidence: 0.94, sourcePage: 1, sourceText: "Employee: Jordan A. Lee" },
    { name: "gross_monthly_income", value: "1850.00", confidence: 0.89, sourcePage: 1, sourceText: "Gross monthly pay: $1,850.00" },
  ] },
  "sample-benefits-letter": { category: "INCOME", expirationDate: null, fields: [
    { name: "legal_name", value: "Jordan A. Lee", confidence: 0.97, sourcePage: 1, sourceText: "Beneficiary: Jordan A. Lee" },
    { name: "monthly_benefit", value: "943.00", confidence: 0.95, sourcePage: 1, sourceText: "Monthly benefit amount: $943.00" },
  ] },
  "sample-homelessness-verification": { category: "HOMELESSNESS_VERIFICATION", expirationDate: null, fields: [
    { name: "legal_name", value: "Jordan A. Lee", confidence: 0.93, sourcePage: 1, sourceText: "Client name: Jordan A. Lee" },
    { name: "verification_date", value: "2026-06-28", confidence: 0.97, sourcePage: 1, sourceText: "Verified on June 28, 2026" },
    { name: "signature_present", value: "true", confidence: 0.9, sourcePage: 1, sourceText: "Signed by outreach coordinator" },
  ] },
};

export class MockDocumentProcessor implements DocumentProcessor {
  async processDocument(input: DocumentProcessingInput): Promise<DocumentProcessingResult> {
    const key = Object.keys(fixtures).find((name) => input.filename.toLowerCase().includes(name));
    if (key) return { ...fixtures[key], category: input.category ?? fixtures[key].category, warnings: [] };
    return {
      category: input.category ?? "OTHER", expirationDate: null,
      fields: [{ name: "document_title", value: input.filename.replace(/\.[^.]+$/, ""), confidence: 0.62, sourcePage: 1, sourceText: "Mock extraction based on filename only." }],
      warnings: ["No demonstration fixture matched this filename. Review the extracted title manually."],
    };
  }
}
