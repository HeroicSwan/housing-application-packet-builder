export type TemplateFieldConfig = {
  id: string;
  fieldKey: string;
  displayLabel: string;
  fieldType: string;
  required: boolean;
  canonicalFieldPath: string | null;
  validationRules: string | null;
  conditionalRules: string | null;
  formattingRules: string | null;
  optionsJson?: string | null;
};

export type CanonicalValue = { value: string | number | boolean | null; sourceType: string; sourceReference: string | null };
export type HouseholdRow = { name: string; relationship: string; dateOfBirth: string | null; monthlyIncomeCents: number | null };
export type CanonicalApplicationData = {
  values: Record<string, CanonicalValue>;
  household: HouseholdRow[];
  conflicts?: Record<string, { values: string[]; sourceReference: string }>;
  expired?: Record<string, string>;
};

export type MappedApplicationField = {
  templateFieldId: string;
  proposedValue: string | null;
  finalValue: string | null;
  sourceType: string;
  sourceReference: string | null;
  populationMethod: string;
  reviewState: string;
  validationState: string;
  staffNote: string | null;
};

const derivedPaths = new Set(["derived.householdSize", "derived.totalMonthlyIncome", "derived.householdTable", "application.applicationDate"]);

export function formatDate(value: string | number | boolean | null) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatCurrency(value: string | number | boolean | null) {
  if (value === null || value === "") return null;
  const cents = Number(value);
  if (!Number.isFinite(cents)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function resolveValue(path: string | null, data: CanonicalApplicationData) {
  if (!path) return null;
  if (path === "derived.householdSize") return { value: data.household.length + 1, sourceType: "DERIVED", sourceReference: "Calculated from household members" };
  if (path === "derived.householdTable") return { value: JSON.stringify(data.household), sourceType: "DERIVED", sourceReference: "Calculated from household members" };
  if (path === "derived.totalMonthlyIncome") {
    const keys = ["finances.monthlyEarnedIncome", "finances.monthlyBenefitsIncome", "finances.otherIncome"];
    return { value: keys.reduce((sum, key) => sum + Number(data.values[key]?.value ?? 0), 0), sourceType: "DERIVED", sourceReference: "Calculated from reviewed income sources" };
  }
  if (path === "application.applicationDate") return data.values[path] ?? { value: new Date().toISOString().slice(0, 10), sourceType: "DEFAULT", sourceReference: "Application creation date" };
  return data.values[path] ?? null;
}

function formatValue(value: string | number | boolean | null, rule: string | null) {
  if (value === null || value === "") return null;
  if (rule === "DATE_US") return formatDate(value);
  if (rule === "CURRENCY_USD") return formatCurrency(value);
  if (rule === "YES_NO") return value === true || value === "true" || value === "Yes" ? "Yes" : "No";
  return String(value);
}

function isApplicable(field: TemplateFieldConfig, data: CanonicalApplicationData) {
  if (!field.conditionalRules) return true;
  const rule = JSON.parse(field.conditionalRules) as { path: string; equals: string };
  return String(data.values[rule.path]?.value ?? "") === rule.equals;
}

function isValid(value: string | null, rules: string | null) {
  if (!value || !rules) return true;
  const parsed = JSON.parse(rules) as { pattern?: string; minLength?: number };
  if (parsed.minLength && value.length < parsed.minLength) return false;
  return parsed.pattern ? new RegExp(parsed.pattern).test(value) : true;
}

export function validateMappingPath(path: string | null, allowedPaths: Set<string>) {
  return !path || allowedPaths.has(path) || derivedPaths.has(path);
}

export function chooseCanonicalValue(base: CanonicalValue, candidates: { value: string; sourceReference: string; reviewed: boolean }[]) {
  const reviewed = candidates.filter((candidate) => candidate.reviewed);
  const selected = reviewed.at(-1);
  return selected ? { value: selected.value, sourceType: "DOCUMENT", sourceReference: selected.sourceReference } satisfies CanonicalValue : base;
}

export function preserveStaffOverride(existing: { populationMethod: string; finalValue: string | null } | undefined, mapped: MappedApplicationField) {
  return Boolean(mapped.templateFieldId && existing?.populationMethod === "STAFF_ENTRY" && existing.finalValue);
}

export function snapshotTemplateVersion(template: { version: number }) { return template.version; }

export function mapTemplateFields(fields: TemplateFieldConfig[], data: CanonicalApplicationData): MappedApplicationField[] {
  return fields.map((field) => {
    if (!isApplicable(field, data)) return { templateFieldId: field.id, proposedValue: null, finalValue: null, sourceType: "CONDITIONAL", sourceReference: "Not applicable", populationMethod: "DEFAULT", reviewState: "NOT_APPLICABLE", validationState: "VALID", staffNote: null };
    if (field.fieldType === "SIGNATURE" || field.fieldType === "SIGNATURE_PLACEHOLDER") return { templateFieldId: field.id, proposedValue: null, finalValue: null, sourceType: "ELECTRONIC_SIGNATURE", sourceReference: "Captured in the electronic signature step", populationMethod: "SIGNATURE_WORKFLOW", reviewState: "EXTERNAL_SIGNATURE", validationState: "VALID", staffNote: null };
    const conflict = field.canonicalFieldPath ? data.conflicts?.[field.canonicalFieldPath] : undefined;
    if (conflict) return { templateFieldId: field.id, proposedValue: conflict.values.join(" | "), finalValue: null, sourceType: "CONFLICTING_SOURCES", sourceReference: conflict.sourceReference, populationMethod: "UNRESOLVED", reviewState: "CONFLICT", validationState: "CONFLICT", staffNote: null };
    const expired = field.canonicalFieldPath ? data.expired?.[field.canonicalFieldPath] : undefined;
    const resolved = resolveValue(field.canonicalFieldPath, data);
    const value = formatValue(resolved?.value ?? null, field.formattingRules);
    const invalid = !isValid(value, field.validationRules);
    const missing = field.required && !value;
    const awaitingConsent = field.fieldKey === "consent_acknowledgment" && value !== "Yes";
    const method = resolved?.sourceType === "DOCUMENT" ? "DOCUMENT_EXTRACTION" : resolved?.sourceType === "DERIVED" ? "DERIVED" : resolved?.sourceType === "DEFAULT" ? "DEFAULT" : resolved ? "CANONICAL_PROFILE" : "UNRESOLVED";
    return {
      templateFieldId: field.id,
      proposedValue: value,
      finalValue: value,
      sourceType: resolved?.sourceType ?? "UNRESOLVED",
      sourceReference: expired ?? resolved?.sourceReference ?? null,
      populationMethod: method,
      reviewState: expired ? "EXPIRED" : awaitingConsent ? "AWAITING_CONFIRMATION" : missing ? "NEEDS_ANSWER" : invalid ? "NEEDS_ANSWER" : value ? "AUTOMATICALLY_COMPLETED" : "NOT_APPLICABLE",
      validationState: expired ? "EXPIRED" : awaitingConsent ? "MISSING" : missing ? "MISSING" : invalid ? "INVALID" : "VALID",
      staffNote: null,
    };
  });
}

export function calculateDraftReadiness(fields: { required: boolean; fieldType?: string; finalValue: string | null; reviewState: string; validationState: string }[]) {
  const blocking = fields.filter((field) => field.required && field.fieldType !== "SIGNATURE" && field.fieldType !== "SIGNATURE_PLACEHOLDER" && (!field.finalValue || ["CONFLICT", "EXPIRED", "MISSING", "INVALID"].includes(field.validationState) || ["NEEDS_ANSWER", "CONFLICT", "EXPIRED", "AWAITING_CONFIRMATION"].includes(field.reviewState)));
  return { ready: blocking.length === 0, blockingCount: blocking.length, completedCount: fields.filter((field) => Boolean(field.finalValue) && field.validationState === "VALID").length, totalCount: fields.length };
}
