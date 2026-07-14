import type { CaseFacts, ReviewItem } from "./inconsistencies";

export type RequirementState = "SATISFIED" | "MISSING" | "EXPIRED" | "NEEDS_REVIEW" | "CONFLICT" | "NOT_APPLICABLE";

export type RequirementInput = {
  id: string;
  name: string;
  category: string;
  isRequired: boolean;
  description?: string;
  expirationPeriodDays?: number | null;
  applicableHouseholdRules?: string | null;
  requiredFieldName?: string | null;
  clientField?: string | null;
};

export type ExtractedFieldInput = {
  fieldName: string;
  extractedValue: string;
  reviewedValue?: string | null;
  reviewStatus: string;
  sourcePage?: number | null;
  sourceText?: string | null;
};

export type DocumentInput = {
  category: string;
  expirationDate?: Date | null;
  processingStatus?: string;
  reviewStatuses: string[];
  extractedFields?: ExtractedFieldInput[];
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

function hasConflict(category: string, conflicts: Array<string | ReviewItem>) {
  return conflicts.some((conflict) => typeof conflict === "string" ? conflict.includes(category) : conflict.categories.includes(category));
}

export function evaluateRequirement(requirement: RequirementInput, documents: DocumentInput[], conflicts: Array<string | ReviewItem> = [], caseFacts?: CaseFacts, now = new Date()) {
  if (!requirement.isRequired) {
    if (requirement.category === "DISABILITY" && !caseFacts?.accessibilityNeeds?.trim()) return { state: "NOT_APPLICABLE" as const, reason: "Disability documentation is conditional, and no related accommodation or support need is recorded." };
    if (requirement.applicableHouseholdRules === "HAS_ADDITIONAL_HOUSEHOLD_MEMBERS" && (caseFacts?.householdCount ?? 1) <= 1) return { state: "NOT_APPLICABLE" as const, reason: "This requirement applies only when additional household members are included." };
  }
  if (hasConflict(requirement.category, conflicts)) return { state: "CONFLICT" as const, reason: "This information differs across the case record or supporting documents and needs staff review." };
  if (requirement.clientField) {
    const value = caseFacts?.requiredFields?.[requirement.clientField];
    return value?.trim() ? { state: "SATISFIED" as const, reason: "The required information is present in the client record." } : { state: "MISSING" as const, reason: `The client record is missing ${requirement.name.toLowerCase()}.` };
  }
  const matching = documents.filter((document) => document.category === requirement.category);
  if (!matching.length) return { state: "MISSING" as const, reason: `No ${requirement.name.toLowerCase()} has been added.` };
  if (matching.every((document) => document.processingStatus && document.processingStatus !== "COMPLETED")) return { state: "NEEDS_REVIEW" as const, reason: "A related document was uploaded, but processing has not completed successfully." };
  const usable = matching.filter((document) => !document.processingStatus || document.processingStatus === "COMPLETED");
  if (usable.length && usable.every((document) => document.expirationDate && startOfDay(document.expirationDate) < startOfDay(now))) return { state: "EXPIRED" as const, reason: "The available supporting document has expired." };
  if (requirement.requiredFieldName) {
    const fields = usable.flatMap((document) => document.extractedFields ?? []).filter((field) => field.fieldName === requirement.requiredFieldName);
    if (!fields.length) return { state: "NEEDS_REVIEW" as const, reason: `The document is present, but ${requirement.requiredFieldName.replaceAll("_", " ")} was not found and needs staff review.` };
    if (fields.every((field) => field.reviewStatus === "REJECTED")) return { state: "NEEDS_REVIEW" as const, reason: "The required extracted value was rejected and has not been replaced with a reviewed value." };
    if (fields.some((field) => field.reviewStatus === "PENDING")) return { state: "NEEDS_REVIEW" as const, reason: "The required extracted value is waiting for staff review." };
    return { state: "SATISFIED" as const, reason: "The required extracted value is present and has been reviewed by staff." };
  }
  const statuses = usable.flatMap((document) => document.extractedFields?.map((field) => field.reviewStatus) ?? document.reviewStatuses);
  if (statuses.some((status) => status === "PENDING" || status === "REJECTED")) return { state: "NEEDS_REVIEW" as const, reason: "A related document contains information that still needs staff review." };
  return { state: "SATISFIED" as const, reason: "A current supporting document is present and its extracted information has been reviewed." };
}

export function evaluateRequirements<T extends RequirementInput>(requirements: T[], documents: DocumentInput[], conflicts: Array<string | ReviewItem> = [], caseFacts?: CaseFacts, now = new Date()) {
  return requirements.map((requirement) => ({ ...requirement, ...evaluateRequirement(requirement, documents, conflicts, caseFacts, now) }));
}
