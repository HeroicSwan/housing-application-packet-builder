export const caseStatuses = ["INTAKE", "COLLECTING_DOCUMENTS", "READY_FOR_REVIEW", "NEEDS_CORRECTION", "APPROVED", "CLOSED"] as const;

export function normalizeCaseName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function normalizeCaseEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("en-US");
  return normalized || null;
}

export function normalizeCasePhone(value: string | null | undefined) {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized.length >= 7 ? normalized : null;
}

export function encodeCaseTags(value: string) {
  const tags = [...new Set(value.split(",").map((tag) => tag.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9 _-]/g, "")).filter(Boolean))].slice(0, 10);
  if (tags.some((tag) => tag.length > 32)) throw new Error("Each case tag must be 32 characters or fewer.");
  return tags.length ? `|${tags.join("|")}|` : "|";
}

export function decodeCaseTags(value: string) {
  return value.split("|").filter(Boolean);
}
