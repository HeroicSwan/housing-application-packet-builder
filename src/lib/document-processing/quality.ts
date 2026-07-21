import { processingResultSchema, type DocumentProcessingResult } from "./types";

export const minimumFieldConfidence = 0.75;
const supportedCategories = new Set(["IDENTITY", "INCOME", "BENEFITS", "LEASE", "BANK_STATEMENT", "TAX", "LETTER", "RESIDENCY", "HOUSEHOLD", "HOMELESSNESS_VERIFICATION", "OTHER"]);

export function enforceExtractionQuality(result: DocumentProcessingResult): DocumentProcessingResult {
  const warnings = [...result.warnings];
  const category = supportedCategories.has(result.category.toUpperCase()) ? result.category.toUpperCase() : "OTHER";
  if (category === "OTHER" && result.category.toUpperCase() !== "OTHER") warnings.push(`Document category ${result.category} was not recognized; routed to OTHER for human review.`);
  const fields = result.fields.flatMap((field) => {
    const value = field.value.normalize("NFKC").trim();
    if (!value) return [];
    if (field.sourcePage === null || !field.sourceText?.trim()) {
      warnings.push(`Abstained from ${field.name}: every accepted value requires a source page and visible evidence snippet.`);
      return [];
    }
    if (field.confidence < minimumFieldConfidence) {
      warnings.push(`Abstained from ${field.name}: confidence ${(field.confidence * 100).toFixed(0)}% is below the ${(minimumFieldConfidence * 100).toFixed(0)}% acceptance threshold.`);
      return [];
    }
    return [{ ...field, value, sourceText: field.sourceText.trim() }];
  });
  const deduplicated = new Map<string, typeof fields[number]>();
  for (const field of fields) {
    const existing = deduplicated.get(field.name);
    if (!existing) { deduplicated.set(field.name, field); continue; }
    if (existing.value !== field.value) {
      warnings.push(`Conflicting values for ${field.name} were found on the same document; both were withheld for human review.`);
      deduplicated.delete(field.name);
      continue;
    }
    if (field.confidence > existing.confidence) deduplicated.set(field.name, field);
  }
  return processingResultSchema.parse({ ...result, category, fields: [...deduplicated.values()], warnings: [...new Set(warnings)] });
}
