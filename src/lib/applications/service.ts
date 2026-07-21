import { db } from "@/lib/db";
import { calculateDraftReadiness, chooseCanonicalValue, mapTemplateFields, preserveStaffOverride, validateMappingPath, type CanonicalApplicationData, type CanonicalValue } from "@/lib/applications/mapping";
import type { CompletedApplicationData } from "@/lib/applications/pdf";
import { normalizeMonthlyIncome } from "@/lib/applications/income";

const fieldToPath: Record<string, string> = {
  legal_name: "client.legalName",
  preferred_name: "client.preferredName",
  date_of_birth: "client.dateOfBirth",
  phone_number: "client.phone",
  email_address: "client.email",
  mailing_address: "client.mailingAddress",
  previous_address: "client.previousAddress",
  current_living_situation: "client.currentLivingSituation",
  preferred_language: "client.preferredLanguage",
  accessibility_accommodations: "client.accessibilityNeeds",
  veteran_status: "client.veteranStatus",
  emergency_contact: "client.emergencyContact",
  benefit_programs: "client.benefitPrograms",
  gross_monthly_income: "finances.monthlyEarnedIncome",
  monthly_benefits_income: "finances.monthlyBenefitsIncome",
  other_income: "finances.otherIncome",
  homelessness_verification_date: "documents.homelessnessVerificationDate",
  identification_type: "documents.identificationType",
  identification_expiration_date: "documents.identificationExpirationDate",
};

const sourceLabels: Record<string, string> = {
  IDENTITY: "From state identification",
  INCOME: "From income statement",
  BENEFITS: "From benefits award letter",
  HOMELESSNESS_VERIFICATION: "From homelessness verification",
  RESIDENCY: "From residency document",
  HOUSEHOLD: "From household documentation",
  OTHER: "From supporting document",
};

function canonical(value: string | number | boolean | null | undefined, reference = "Canonical client profile"): CanonicalValue {
  return { value: value ?? null, sourceType: "CANONICAL_PROFILE", sourceReference: reference };
}

export async function buildCanonicalApplicationData(clientCaseId: string): Promise<CanonicalApplicationData> {
  const clientCase = await db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId }, include: { assignedCaseworker: true, incomeRecords: true, householdMembers: { orderBy: { createdAt: "asc" } }, customFieldValues: { include: { definition: true } }, documents: { include: { extractedFields: true }, orderBy: { uploadedAt: "asc" } } } });
  const activeIncome = clientCase.incomeRecords.filter((record) => !record.endDate || record.endDate >= new Date());
  const incomeTotals = { EARNED: 0, BENEFIT: 0, OTHER: 0 }; for (const record of activeIncome) incomeTotals[record.incomeType as keyof typeof incomeTotals] += normalizeMonthlyIncome(record);
  const values: Record<string, CanonicalValue> = {
    "client.legalName": canonical(clientCase.legalName), "client.preferredName": canonical(clientCase.preferredName), "client.dateOfBirth": canonical(clientCase.dateOfBirth?.toISOString().slice(0, 10)),
    "client.phone": canonical(clientCase.phone), "client.email": canonical(clientCase.email), "client.mailingAddress": canonical(clientCase.mailingAddress), "client.previousAddress": canonical(clientCase.previousAddress),
    "client.currentLivingSituation": canonical(clientCase.currentLivingSituation), "client.preferredLanguage": canonical(clientCase.preferredLanguage), "client.accessibilityNeeds": canonical(clientCase.accessibilityNeeds),
    "client.veteranStatus": canonical(clientCase.veteranStatus), "client.emergencyContact": canonical(clientCase.emergencyContact), "client.benefitPrograms": canonical(clientCase.benefitPrograms),
    "client.consentConfirmed": canonical(Boolean(clientCase.consentConfirmedAt), clientCase.consentConfirmedAt ? "Confirmed by caseworker" : "Consent not yet confirmed"),
    "finances.monthlyEarnedIncome": canonical(activeIncome.length ? Math.round(incomeTotals.EARNED) : clientCase.monthlyEarnedIncomeCents, activeIncome.length ? "Normalized from active income records" : undefined), "finances.monthlyBenefitsIncome": canonical(activeIncome.length ? Math.round(incomeTotals.BENEFIT) : clientCase.monthlyBenefitsIncomeCents, activeIncome.length ? "Normalized from active income records" : undefined), "finances.otherIncome": canonical(activeIncome.length ? Math.round(incomeTotals.OTHER) : clientCase.otherIncomeCents, activeIncome.length ? "Normalized from active income records" : undefined),
    "documents.homelessnessVerificationDate": canonical(null), "documents.identificationType": canonical(null), "documents.identificationExpirationDate": canonical(null),
    "client.contactPermission": canonical(clientCase.contactPermission), "client.transportationNeeds": canonical(clientCase.transportationNeeds), "client.desiredMoveInDate": canonical(clientCase.desiredMoveInDate?.toISOString().slice(0, 10)), "client.evictionHistory": canonical(clientCase.evictionHistory), "client.rentalArrears": canonical(clientCase.rentalArrearsCents), "client.preferredContactMethod": canonical(null),
    "assignedCaseworker.name": canonical(clientCase.assignedCaseworker.name, "Assigned caseworker"), "application.applicationDate": { value: new Date().toISOString().slice(0, 10), sourceType: "DEFAULT", sourceReference: "Application creation date" },
  };
  for (const item of clientCase.customFieldValues.filter((entry) => entry.definition.active)) values[`custom.${item.definition.key}`] = canonical(item.value, `Agency-specific field: ${item.definition.label}`);
  const observed: Record<string, { value: string; reference: string; reviewed: boolean }[]> = {};
  for (const document of clientCase.documents) for (const field of document.extractedFields.filter((item) => item.reviewStatus !== "REJECTED")) {
    const path = fieldToPath[field.fieldName];
    if (!path) continue;
    const value = field.reviewedValue ?? field.extractedValue;
    const reference = `${sourceLabels[document.documentCategory] ?? "From supporting document"} (${document.originalFilename})`;
    (observed[path] ??= []).push({ value, reference, reviewed: field.reviewStatus === "APPROVED" || field.reviewStatus === "EDITED" });
  }
  const conflicts: NonNullable<CanonicalApplicationData["conflicts"]> = {};
  for (const [path, items] of Object.entries(observed)) {
    values[path] = chooseCanonicalValue(values[path] ?? canonical(null), items.map((item) => ({ value: item.value, sourceReference: item.reference, reviewed: item.reviewed })));
    const distinct = [...new Set([String(values[path]?.value ?? ""), ...items.map((item) => item.value)].filter(Boolean))];
    if (distinct.length > 1) conflicts[path] = { values: distinct, sourceReference: items.map((item) => item.reference).join("; ") };
  }
  const expired: NonNullable<CanonicalApplicationData["expired"]> = {};
  for (const document of clientCase.documents) if (document.expirationDate && document.expirationDate < new Date() && document.documentCategory === "IDENTITY") expired["documents.identificationExpirationDate"] = `Expired ${document.expirationDate.toISOString().slice(0, 10)} - upload a current identification document or confirm an updated date`;
  return { values, household: clientCase.householdMembers.map((member) => { const records = activeIncome.filter((record) => record.householdMemberId === member.id); return { name: member.name, relationship: member.relationship, dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? null, monthlyIncomeCents: records.length ? Math.round(records.reduce((sum, record) => sum + normalizeMonthlyIncome(record), 0)) : member.monthlyIncomeCents }; }), conflicts, expired };
}

export async function createOrRefreshDraft(clientCaseId: string, templateId: string, userId: string) {
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { fields: { orderBy: { displayOrder: "asc" } } } });
  const data = await buildCanonicalApplicationData(clientCaseId);
  const allowedPaths = new Set(Object.keys(data.values));
  const invalid = template.fields.find((field) => !validateMappingPath(field.canonicalFieldPath, allowedPaths));
  if (invalid) throw new Error(`Template field "${invalid.fieldKey}" has an invalid canonical mapping.`);
  const mapped = mapTemplateFields(template.fields, data);
  const draft = await db.applicationDraft.upsert({ where: { clientCaseId_templateId: { clientCaseId, templateId } }, create: { clientCaseId, templateId, templateVersion: template.version, createdById: userId }, update: {} });
  const existing = await db.applicationDraftField.findMany({ where: { draftId: draft.id } });
  const existingByTemplateField = new Map(existing.map((field) => [field.templateFieldId, field]));
  for (const item of mapped) {
    const current = existingByTemplateField.get(item.templateFieldId);
    if (preserveStaffOverride(current, item)) continue;
    await db.applicationDraftField.upsert({ where: { draftId_templateFieldId: { draftId: draft.id, templateFieldId: item.templateFieldId } }, create: { draftId: draft.id, ...item }, update: item });
  }
  const eligibleDocuments = await db.uploadedDocument.findMany({ where: { clientCaseId, processingStatus: "COMPLETED" }, include: { extractedFields: true } });
  for (const document of eligibleDocuments) {
    const usable = !document.extractedFields.some((field) => field.reviewStatus === "REJECTED");
    await db.applicationDraftDocument.upsert({ where: { draftId_uploadedDocumentId: { draftId: draft.id, uploadedDocumentId: document.id } }, create: { draftId: draft.id, uploadedDocumentId: document.id, selected: usable, authorized: true }, update: {} });
  }
  await updateDraftReadiness(draft.id);
  return db.applicationDraft.findUniqueOrThrow({ where: { id: draft.id } });
}

export async function updateDraftReadiness(draftId: string) {
  const fields = await db.applicationDraftField.findMany({ where: { draftId }, include: { templateField: true } });
  const readiness = calculateDraftReadiness(fields.map((field) => ({ required: field.templateField.required, fieldType: field.templateField.fieldType, finalValue: field.finalValue, reviewState: field.reviewState, validationState: field.validationState })));
  await db.applicationDraft.update({ where: { id: draftId }, data: { status: readiness.ready ? "READY_TO_GENERATE" : "NEEDS_INFORMATION" } });
  return readiness;
}

export async function getCompletedApplicationData(draftId: string): Promise<{ draft: Awaited<ReturnType<typeof loadDraft>>; pdfData: CompletedApplicationData }> {
  const draft = await loadDraft(draftId);
  return { draft, pdfData: { programName: draft.template.housingProgram.name, applicationName: draft.template.name, templateVersion: draft.templateVersion, applicationReference: `${draft.clientCase.referenceNumber}-APP-V${Math.max(1, draft.generationVersion)}`, generationVersion: Math.max(1, draft.generationVersion), generatedAt: draft.generatedAt ?? new Date(), signature: draft.signature ? { signedName: draft.signature.signedName, signedAt: draft.signature.signedAt, method: draft.signature.signatureMethod } : null, fields: draft.fields.map((field) => ({ key: field.templateField.fieldKey, label: field.templateField.displayLabel, type: field.templateField.fieldType, required: field.templateField.required, value: field.finalValue, section: field.templateField.section, pageNumber: field.templateField.pageNumber })) } };
}

function loadDraft(draftId: string) {
  return db.applicationDraft.findUniqueOrThrow({ where: { id: draftId }, include: { clientCase: { include: { selectedProgram: { include: { requirements: true } } } }, template: { include: { housingProgram: true } }, signature: true, fields: { include: { templateField: true }, orderBy: { templateField: { displayOrder: "asc" } } }, documents: { include: { uploadedDocument: { include: { extractedFields: true } } } } } });
}
