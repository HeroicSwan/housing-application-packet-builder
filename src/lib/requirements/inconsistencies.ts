export type ExtractedValue = { fieldName: string; value: string; category: string };
export type DocumentFact = { category: string; expirationDate?: Date | null };
export type CaseFacts = {
  legalName: string;
  dateOfBirth?: Date | null;
  householdCount: number;
  accessibilityNeeds?: string | null;
  householdHasChildren?: boolean;
  documents?: DocumentFact[];
  requiredFields?: Record<string, string | null | undefined>;
};

export type ReviewItem = { code: string; severity: "REVIEW" | "BLOCKING"; message: string; categories: string[] };

export function normalizeName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function namesEquivalent(left: string, right: string) {
  const a = normalizeName(left); const b = normalizeName(right);
  if (a.join(" ") === b.join(" ")) return true;
  const withoutInitials = (tokens: string[]) => tokens.filter((token, index) => index === 0 || index === tokens.length - 1 || token.length > 1);
  return withoutInitials(a).join(" ") === withoutInitials(b).join(" ");
}

export function normalizeDate(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const date = match ? new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]))) : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function parseCurrency(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectInconsistencies(caseFacts: CaseFacts, values: ExtractedValue[], now = new Date()): ReviewItem[] {
  const items: ReviewItem[] = [];
  const names = values.filter((value) => value.fieldName === "legal_name");
  if (names.some((name) => !namesEquivalent(name.value, caseFacts.legalName))) items.push({ code: "LEGAL_NAME_CONFLICT", severity: "BLOCKING", message: "A legal name differs between the case record and a supporting document.", categories: ["IDENTITY", "INCOME"] });
  const expectedDate = caseFacts.dateOfBirth?.toISOString().slice(0, 10);
  const dates = values.filter((value) => value.fieldName === "date_of_birth");
  if (expectedDate && dates.some((date) => normalizeDate(date.value) !== expectedDate)) items.push({ code: "DOB_CONFLICT", severity: "BLOCKING", message: "A date of birth differs between the case record and a supporting document.", categories: ["IDENTITY"] });
  const counts = values.filter((value) => value.fieldName === "household_count");
  if (counts.some((count) => Number(count.value.replace(/\D/g, "")) !== caseFacts.householdCount)) items.push({ code: "HOUSEHOLD_COUNT_CONFLICT", severity: "REVIEW", message: "The documented household count does not match the case record.", categories: ["HOUSEHOLD"] });
  const incomeGroups = new Map<string, number[]>();
  for (const value of values.filter((item) => ["gross_monthly_income", "monthly_income", "monthly_benefit"].includes(item.fieldName))) {
    const amount = parseCurrency(value.value); if (amount == null) continue;
    const group = incomeGroups.get(value.fieldName) ?? []; group.push(amount); incomeGroups.set(value.fieldName, group);
  }
  if ([...incomeGroups.values()].some((amounts) => amounts.length > 1 && Math.max(...amounts) - Math.min(...amounts) > Math.max(100, Math.max(...amounts) * 0.1))) items.push({ code: "INCOME_CONFLICT", severity: "REVIEW", message: "Monthly income amounts differ meaningfully across supporting documents.", categories: ["INCOME"] });
  if ((caseFacts.documents ?? []).some((document) => document.category === "IDENTITY" && document.expirationDate && document.expirationDate < now)) items.push({ code: "EXPIRED_IDENTITY", severity: "REVIEW", message: "An identity document has expired and may need replacement.", categories: ["IDENTITY"] });
  if (values.some((value) => value.fieldName === "signature_present" && !["true", "yes", "signed", "1"].includes(value.value.trim().toLowerCase()))) items.push({ code: "MISSING_SIGNATURE", severity: "BLOCKING", message: "A document that requires a signature appears to be unsigned.", categories: ["OTHER", "HOMELESSNESS_VERIFICATION"] });
  for (const [field, value] of Object.entries(caseFacts.requiredFields ?? {})) if (!value?.trim()) items.push({ code: `MISSING_${field.toUpperCase()}`, severity: "REVIEW", message: `${field.replaceAll("_", " ")} is blank in the case record.`, categories: ["OTHER"] });
  return items;
}
