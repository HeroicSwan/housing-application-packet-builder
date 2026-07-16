import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countApplicationRows } from "../scripts/application-data.mjs";
import { resolveE2eDatabaseUrl } from "../scripts/e2e-database.mjs";
import { resolveLocalDatabaseUrl } from "../scripts/local-database.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
const dataMode = process.env.DATA_MODE ?? "synthetic";
const seedContext = process.env.SYNTHETIC_SEED_CONTEXT;
const syntheticOrganizationId = "synthetic-demo-organization";
if (!databaseUrl) throw new Error("DATABASE_URL is required for synthetic seeding.");
if (dataMode !== "synthetic") throw new Error("Synthetic seeding never runs outside the synthetic profile. Production databases start blank and are claimed once through /setup.");
if (seedContext === "e2e") {
  if (process.env.E2E_DATABASE_URL !== databaseUrl) throw new Error("The E2E seed requires matching isolated database settings.");
  resolveE2eDatabaseUrl(repositoryRoot, databaseUrl);
} else if (["local-empty", "local-reset"].includes(seedContext)) {
  resolveLocalDatabaseUrl(repositoryRoot, databaseUrl);
} else {
  throw new Error("Destructive synthetic seeding must run through db:setup, db:reset, or test:e2e.");
}

const db = new PrismaClient();
if (seedContext === "local-empty") {
  const existingRows = await countApplicationRows(db);
  if (existingRows) {
    await db.$disconnect();
    throw new Error("The preserving local seed requires an empty synthetic database.");
  }
}
const passwordHash = await bcrypt.hash("DemoHousing2026!", 10);

await db.auditEvent.deleteMany();
await db.applicationSubmission.deleteMany();
await db.applicationSignature.deleteMany();
await db.consentRecord.deleteMany();
await db.applicationDraftDocument.deleteMany();
await db.applicationDraftField.deleteMany();
await db.applicationDraft.deleteMany();
await db.applicationTemplateField.deleteMany();
await db.applicationTemplate.deleteMany();
await db.reviewNote.deleteMany();
await db.packetField.deleteMany();
await db.applicationPacket.deleteMany();
await db.extractedField.deleteMany();
await db.uploadedDocument.deleteMany();
await db.incomeRecord.deleteMany();
await db.householdMember.deleteMany();
await db.clientCase.deleteMany();
await db.programRequirement.deleteMany();
await db.submissionDestination.deleteMany();
await db.housingProgram.deleteMany();
await db.authSession.deleteMany();
await db.mfaChallenge.deleteMany();
await db.passwordResetToken.deleteMany();
await db.rateLimitBucket.deleteMany();
await db.backupRun.deleteMany();
await db.user.deleteMany();
await db.organization.deleteMany();

const ownerOrganization = await db.organization.create({ data: {
  id: syntheticOrganizationId,
  slug: "synthetic-housing-demo",
  name: "Synthetic Housing Demonstration",
} });

const [caseworker, reviewer] = await Promise.all([
  db.user.create({ data: { organizationId: ownerOrganization.id, name: "Maya Ortiz", email: "caseworker@example.org", role: "CASEWORKER", passwordHash } }),
  db.user.create({ data: { organizationId: ownerOrganization.id, name: "Daniel Cho", email: "reviewer@example.org", role: "REVIEWER", passwordHash } }),
]);
await db.user.create({ data: { organizationId: ownerOrganization.id, name: "Priya Shah", email: "admin@example.org", role: "ADMIN", passwordHash } });

const requirementSets = {
  harbor: [
    ["Government-issued identification", "IDENTITY", true, 3650],
    ["Proof of income or no-income declaration", "INCOME", true, 90],
    ["Homelessness verification", "HOMELESSNESS_VERIFICATION", true, 60],
    ["Signed consent form", "OTHER", true, null],
    ["Residency documentation", "RESIDENCY", true, 90],
    ["Program-specific intake form", "OTHER", true, null],
  ],
  north: [
    ["Government-issued identification", "IDENTITY", true, 3650],
    ["Benefits award letter", "INCOME", true, 120],
    ["Disability verification when applicable", "DISABILITY", false, 365],
    ["Homelessness verification", "HOMELESSNESS_VERIFICATION", true, 60],
    ["Signed consent form", "OTHER", true, null],
    ["Background-information acknowledgment", "OTHER", true, null],
  ],
  family: [
    ["Government-issued identification", "IDENTITY", true, 3650],
    ["Proof of income or no-income declaration", "INCOME", true, 90],
    ["Household member documentation", "HOUSEHOLD", true, 365],
    ["Residency documentation", "RESIDENCY", true, 90],
    ["Signed consent form", "OTHER", true, null],
    ["Program-specific intake form", "OTHER", true, null],
  ],
};

async function createProgram(name, organization, description, rows) {
  return db.housingProgram.create({
    data: {
      organizationId: ownerOrganization.id, name, organization, description, fictional: true, isActive: true,
      incomeLimitNotes: "Income is reviewed by qualified program staff; this tool does not determine eligibility.",
      contactInformation: "Demonstration contact only — programs and organizations are fictional.",
      requirements: { create: rows.map(([requirementName, category, isRequired, expirationPeriodDays], sortOrder) => ({
        name: requirementName, category, isRequired, expirationPeriodDays, sortOrder,
        description: `Provide reviewable documentation for ${requirementName.toLowerCase()}.`,
        validationRules: "Human review required before submission.",
        requiredFieldName: requirementName === "Government-issued identification" ? "legal_name" : requirementName.includes("Signed consent") ? "signature_present" : null,
        applicableHouseholdRules: requirementName.includes("Household member") ? "HAS_ADDITIONAL_HOUSEHOLD_MEMBERS" : null,
      })) },
    },
    include: { requirements: true },
  });
}

const harbor = await createProgram("Harbor Bridge Transitional Housing", "Harbor Bridge Community Services", "Time-limited transitional housing with case management for adults.", requirementSets.harbor);
const north = await createProgram("North County Supportive Housing", "North County Housing Collaborative", "Supportive housing demonstration program for adults with ongoing service needs.", requirementSets.north);
const family = await createProgram("Family Pathways Rapid Rehousing", "Family Pathways Network", "Rapid rehousing demonstration program for households with children.", requirementSets.family);

const templateFieldRows = [
  ["applicant_legal_name", "Legal name", "TEXT", true, "client.legalName", 1, "Applicant information", null],
  ["applicant_preferred_name", "Preferred name", "TEXT", false, "client.preferredName", 1, "Applicant information", null],
  ["applicant_date_of_birth", "Date of birth", "DATE", true, "client.dateOfBirth", 1, "Applicant information", "DATE_US"],
  ["phone_number", "Phone", "TEXT", true, "client.phone", 1, "Contact information", null],
  ["email_address", "Email", "TEXT", true, "client.email", 1, "Contact information", null],
  ["mailing_address", "Current mailing address", "MULTILINE_TEXT", true, "client.mailingAddress", 1, "Contact information", null],
  ["previous_address", "Previous address", "MULTILINE_TEXT", false, "client.previousAddress", 1, "Contact information", null],
  ["preferred_contact_method", "Preferred contact method", "SINGLE_SELECT", true, "client.preferredContactMethod", 1, "Contact information", null],
  ["current_living_situation", "Current living situation", "MULTILINE_TEXT", true, "client.currentLivingSituation", 2, "Housing situation", null],
  ["homelessness_verification_date", "Homelessness-verification date", "DATE", true, "documents.homelessnessVerificationDate", 2, "Housing situation", "DATE_US"],
  ["desired_move_in_date", "Desired move-in date", "DATE", false, "client.desiredMoveInDate", 2, "Housing situation", "DATE_US"],
  ["household_size", "Household size", "NUMBER", true, "derived.householdSize", 2, "Household", null],
  ["household_members", "Household members", "HOUSEHOLD_TABLE", true, "derived.householdTable", 2, "Household", null],
  ["monthly_earned_income", "Monthly earned income", "CURRENCY", true, "finances.monthlyEarnedIncome", 3, "Income and benefits", "CURRENCY_USD"],
  ["monthly_benefits_income", "Monthly benefits income", "CURRENCY", true, "finances.monthlyBenefitsIncome", 3, "Income and benefits", "CURRENCY_USD"],
  ["other_income", "Other monthly income", "CURRENCY", false, "finances.otherIncome", 3, "Income and benefits", "CURRENCY_USD"],
  ["total_household_income", "Total monthly household income", "CURRENCY", true, "derived.totalMonthlyIncome", 3, "Income and benefits", "CURRENCY_USD"],
  ["benefit_programs", "Benefit programs", "MULTIPLE_SELECT", false, "client.benefitPrograms", 3, "Income and benefits", null],
  ["accessibility_accommodations", "Accessibility accommodations", "MULTILINE_TEXT", false, "client.accessibilityNeeds", 3, "Accessibility and support needs", null],
  ["transportation_needs", "Transportation needs", "MULTILINE_TEXT", false, "client.transportationNeeds", 3, "Accessibility and support needs", null],
  ["veteran_status", "Veteran status", "SINGLE_SELECT", true, "client.veteranStatus", 3, "Accessibility and support needs", null],
  ["eviction_history", "Prior eviction history", "MULTILINE_TEXT", false, "client.evictionHistory", 3, "Housing history", null],
  ["rental_arrears", "Outstanding rental arrears", "CURRENCY", false, "client.rentalArrears", 3, "Housing history", "CURRENCY_USD"],
  ["preferred_language", "Preferred language", "TEXT", true, "client.preferredLanguage", 4, "Accessibility and support needs", null],
  ["emergency_contact", "Emergency contact", "MULTILINE_TEXT", true, "client.emergencyContact", 4, "Contact information", null],
  ["identification_type", "Identification type", "TEXT", true, "documents.identificationType", 4, "Documentation", null],
  ["identification_expiration_date", "Identification expiration date", "DATE", true, "documents.identificationExpirationDate", 4, "Documentation", "DATE_US"],
  ["contact_permission", "Permission to contact applicant", "BOOLEAN", false, "client.contactPermission", 4, "Consent and signatures", "YES_NO"],
  ["consent_acknowledgment", "Applicant consent confirmed", "BOOLEAN", true, "client.consentConfirmed", 4, "Consent and signatures", "YES_NO"],
  ["applicant_signature", "Applicant signature", "SIGNATURE_PLACEHOLDER", false, null, 4, "Consent and signatures", null],
  ["caseworker_name", "Caseworker name", "TEXT", true, "assignedCaseworker.name", 4, "Caseworker certification", null],
  ["application_date", "Application date", "DATE", true, "application.applicationDate", 4, "Caseworker certification", "DATE_US"],
];

const familyTemplate = await db.applicationTemplate.create({ data: {
  housingProgramId: family.id, name: "Family Pathways Housing Application", description: "Versioned generated application form for the fictional Family Pathways Rapid Rehousing program.", version: 1, status: "ACTIVE", publishedAt: new Date(), templateType: "GENERATED_PDF",
  sourceFilePath: "fixtures/templates/family-pathways-housing-application-v1.json", outputFilenamePattern: "family-pathways-application-{client}-v{version}.pdf",
  fields: { create: templateFieldRows.map(([fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pageNumber, section, formattingRules], displayOrder) => ({ fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pageNumber, section, formattingRules, displayOrder, staffGuidance: required ? "Required by the Family Pathways application." : "Optional when applicable.", optionsJson: ["preferred_contact_method", "veteran_status"].includes(fieldKey) ? JSON.stringify(fieldKey === "preferred_contact_method" ? ["Phone", "Email", "Text"] : ["Yes", "No", "Prefer not to answer"]) : null })) },
}, include: { fields: true } });

await db.applicationTemplate.create({ data: {
  housingProgramId: family.id, name: "Family Pathways Agency AcroForm", description: "Synthetic agency-style fillable PDF used to verify import, mapping, and field population.", version: 1, status: "ACTIVE", publishedAt: new Date(), templateType: "ACROFORM", sourceFilePath: "fixtures/family-pathways-agency-acroform.pdf", outputFilenamePattern: "family-pathways-acroform-{client}-v{version}.pdf",
  fields: { create: [
    ["applicant_name", "Applicant legal name", "TEXT", true, "client.legalName", "Applicant.Name"],
    ["applicant_dob", "Date of birth", "DATE", true, "client.dateOfBirth", "Applicant.DOB"],
    ["applicant_phone", "Phone", "TEXT", true, "client.phone", "Applicant.Phone"],
    ["applicant_email", "Email", "TEXT", true, "client.email", "Applicant.Email"],
    ["household_size", "Household size", "TEXT", true, "derived.householdSize", "Household.Size"],
    ["monthly_income", "Total monthly income", "CURRENCY", true, "derived.totalMonthlyIncome", "Income.Monthly"],
    ["consent", "Applicant consent confirmed", "BOOLEAN", true, "client.consentConfirmed", "Consent.Yes"],
    ["signature", "Electronic signature", "SIGNATURE", true, null, "Signature.Typed"],
  ].map(([fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pdfFieldName], displayOrder) => ({ fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pdfFieldName, pageNumber: 1, section: "Agency application", displayOrder, staffGuidance: canonicalFieldPath ? "Mapped from reviewed application information." : "Captured through the electronic signature workflow." })) },
} });

const caseRows = [
  ["HAP-2026-0041", "Sam Rivera", "Sam Rivera", "COLLECTING_DOCUMENTS", harbor.id, "Temporary shelter"],
  ["HAP-2026-0042", "Jordan Lee", "Jordan A. Lee", "READY_FOR_REVIEW", north.id, "Unsheltered"],
  ["HAP-2026-0043", "Jordan", "Jordan Rivera", "COLLECTING_DOCUMENTS", family.id, "Staying temporarily with family"],
  ["HAP-2026-0044", "Taylor Brooks", "Taylor Brooks", "APPROVED", harbor.id, "Transitional housing"],
  ["HAP-2026-0045", "Casey Bennett", "Casey Bennett", "INTAKE", null, "Emergency motel"],
];

const cases = [];
for (const [referenceNumber, preferredName, legalName, status, selectedProgramId, currentLivingSituation] of caseRows) {
  cases.push(await db.clientCase.create({ data: {
    organizationId: ownerOrganization.id, referenceNumber, preferredName, legalName, status, selectedProgramId, currentLivingSituation,
    assignedCaseworkerId: caseworker.id, preferredLanguage: "English", dateOfBirth: new Date("1988-06-14"),
  } }));
}

await db.clientCase.update({ where: { id: cases[2].id }, data: {
  dateOfBirth: new Date("1990-05-08"), preferredLanguage: "English", phone: "(555) 014-2280", email: "jordan.rivera@example.test",
  previousAddress: "42 Cedar Street, Riverton, NY 10002", veteranStatus: "No", benefitPrograms: "SNAP; Medicaid",
  monthlyEarnedIncomeCents: 145000, monthlyBenefitsIncomeCents: 62000, otherIncomeCents: 0,
  accessibilityNeeds: "Ground-floor unit or elevator access", desiredMoveInDate: new Date("2026-08-15"), transportationNeeds: "Access to a nearby bus route",
  evictionHistory: "No prior evictions reported", rentalArrearsCents: 0, contactPermission: true,
} });

await db.householdMember.createMany({ data: [
  { clientCaseId: cases[2].id, name: "Riley Rivera", relationship: "Child", dateOfBirth: new Date("2017-04-12"), monthlyIncomeCents: 0 },
  { clientCaseId: cases[2].id, name: "Jamie Rivera", relationship: "Child", dateOfBirth: new Date("2020-09-03"), monthlyIncomeCents: 0 },
] });
await db.incomeRecord.createMany({ data: [
  { clientCaseId: cases[2].id, earnerName: "Jordan Rivera", sourceName: "Riverton Market", incomeType: "EARNED", amountCents: 100000, frequency: "MONTHLY", isGross: true },
  { clientCaseId: cases[2].id, earnerName: "Jordan Rivera", sourceName: "Weekend cleaning work", incomeType: "EARNED", amountCents: 45000, frequency: "MONTHLY", isGross: true },
  { clientCaseId: cases[2].id, earnerName: "Jordan Rivera", sourceName: "Family assistance benefit", incomeType: "BENEFIT", amountCents: 62000, frequency: "MONTHLY", isGross: true },
] });

const idDoc = await db.uploadedDocument.create({ data: {
  clientCaseId: cases[1].id, originalFilename: "sample-id.pdf", safeFilename: "seed-sample-id.pdf", fileType: "application/pdf",
  storagePath: "fixtures/sample-id.pdf", documentCategory: "IDENTITY", processingStatus: "COMPLETED", uploadedById: caseworker.id,
  expirationDate: new Date("2028-09-30"),
  extractedFields: { create: [
    { fieldName: "legal_name", extractedValue: "Jordan A. Lee", confidence: 0.98, sourcePage: 1, sourceText: "Name: Jordan A. Lee", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
    { fieldName: "date_of_birth", extractedValue: "1988-06-14", confidence: 0.96, sourcePage: 1, sourceText: "DOB: 06/14/1988", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
  ] },
} });
const conflictDoc = await db.uploadedDocument.create({ data: {
  clientCaseId: cases[2].id, originalFilename: "jordan-benefits-award.pdf", safeFilename: "seed-jordan-benefits.pdf", fileType: "application/pdf",
  storagePath: "fixtures/jordan-benefits-award.pdf", documentCategory: "BENEFITS", processingStatus: "COMPLETED", uploadedById: caseworker.id,
  extractedFields: { create: [
    { fieldName: "monthly_benefits_income", extractedValue: "62000", confidence: 0.97, sourcePage: 1, sourceText: "Monthly benefit: $620.00", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
    { fieldName: "benefit_programs", extractedValue: "SNAP; Medicaid", confidence: 0.94, sourcePage: 1, sourceText: "Programs: SNAP and Medicaid", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
    { fieldName: "date_of_birth", extractedValue: "1990-05-09", confidence: 0.72, sourcePage: 1, sourceText: "DOB: 05/09/1990", reviewStatus: "PENDING" },
  ] },
} });

const jordanIdDoc = await db.uploadedDocument.create({ data: {
  clientCaseId: cases[2].id, originalFilename: "jordan-state-identification.pdf", safeFilename: "seed-jordan-id.pdf", fileType: "application/pdf",
  storagePath: "fixtures/jordan-state-identification.pdf", documentCategory: "IDENTITY", processingStatus: "COMPLETED", uploadedById: caseworker.id, expirationDate: new Date("2025-04-30"),
  extractedFields: { create: [
    { fieldName: "legal_name", extractedValue: "Jordan Rivera", confidence: 0.99, sourcePage: 1, sourceText: "Name: Jordan Rivera", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
    { fieldName: "date_of_birth", extractedValue: "1990-05-08", confidence: 0.99, sourcePage: 1, sourceText: "DOB: 05/08/1990", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
    { fieldName: "identification_type", extractedValue: "State identification card", confidence: 0.98, sourcePage: 1, sourceText: "Document type: State ID", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
    { fieldName: "identification_expiration_date", extractedValue: "2025-04-30", confidence: 0.99, sourcePage: 1, sourceText: "Expires: 04/30/2025", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() },
  ] },
} });

const jordanIncomeDoc = await db.uploadedDocument.create({ data: {
  clientCaseId: cases[2].id, originalFilename: "jordan-income-statement.pdf", safeFilename: "seed-jordan-income.pdf", fileType: "application/pdf",
  storagePath: "fixtures/jordan-income-statement.pdf", documentCategory: "INCOME", processingStatus: "COMPLETED", uploadedById: caseworker.id,
  extractedFields: { create: [{ fieldName: "gross_monthly_income", extractedValue: "145000", confidence: 0.96, sourcePage: 1, sourceText: "Gross monthly income: $1,450.00", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() }] },
} });

const jordanHomelessnessDoc = await db.uploadedDocument.create({ data: {
  clientCaseId: cases[2].id, originalFilename: "jordan-homelessness-verification.pdf", safeFilename: "seed-jordan-homelessness.pdf", fileType: "application/pdf",
  storagePath: "fixtures/jordan-homelessness-verification.pdf", documentCategory: "HOMELESSNESS_VERIFICATION", processingStatus: "COMPLETED", uploadedById: caseworker.id,
  extractedFields: { create: [{ fieldName: "homelessness_verification_date", extractedValue: "2026-06-25", confidence: 0.97, sourcePage: 1, sourceText: "Verified on June 25, 2026", reviewStatus: "APPROVED", reviewerId: reviewer.id, reviewedAt: new Date() }] },
} });

const seededApplicationValues = {
  applicant_legal_name: "Jordan Rivera", applicant_preferred_name: "Jordan", applicant_date_of_birth: null,
  phone_number: "(555) 014-2280", email_address: "jordan.rivera@example.test", mailing_address: null,
  previous_address: "42 Cedar Street, Riverton, NY 10002", preferred_contact_method: null,
  current_living_situation: "Staying temporarily with family", homelessness_verification_date: "06/25/2026", desired_move_in_date: "08/15/2026",
  household_size: "3", household_members: JSON.stringify([{ name: "Riley Rivera", relationship: "Child", dateOfBirth: "2017-04-12", monthlyIncomeCents: 0 }, { name: "Jamie Rivera", relationship: "Child", dateOfBirth: "2020-09-03", monthlyIncomeCents: 0 }]),
  monthly_earned_income: "$1,450.00", monthly_benefits_income: "$620.00", other_income: "$0.00", total_household_income: "$2,070.00",
  benefit_programs: "SNAP; Medicaid", accessibility_accommodations: "Ground-floor unit or elevator access", transportation_needs: "Access to a nearby bus route",
  veteran_status: "No", eviction_history: "No prior evictions reported", rental_arrears: "$0.00", preferred_language: "English", emergency_contact: null,
  identification_type: "State identification card", identification_expiration_date: "04/30/2025", contact_permission: "Yes",
  consent_acknowledgment: "No", applicant_signature: null, caseworker_name: "Maya Ortiz", application_date: new Date().toLocaleDateString("en-US", { timeZone: "UTC" }),
};
const unresolvedSeedFields = new Set(["mailing_address", "preferred_contact_method", "emergency_contact"]);
await db.applicationDraft.create({ data: {
  clientCaseId: cases[2].id, templateId: familyTemplate.id, templateVersion: familyTemplate.version, status: "NEEDS_INFORMATION", createdById: caseworker.id,
  fields: { create: familyTemplate.fields.map((field) => {
    const value = seededApplicationValues[field.fieldKey] ?? null;
    const conflict = field.fieldKey === "applicant_date_of_birth";
    const expired = field.fieldKey === "identification_expiration_date";
    const consent = field.fieldKey === "consent_acknowledgment";
    const method = ["household_size", "household_members", "total_household_income"].includes(field.fieldKey) ? "DERIVED" : ["identification_type", "identification_expiration_date", "homelessness_verification_date", "monthly_earned_income", "monthly_benefits_income", "benefit_programs"].includes(field.fieldKey) ? "DOCUMENT_EXTRACTION" : value ? "CANONICAL_PROFILE" : "UNRESOLVED";
    return { templateFieldId: field.id, proposedValue: conflict ? "05/08/1990 | 05/09/1990" : value, finalValue: conflict ? null : value, sourceType: conflict ? "CONFLICTING_SOURCES" : method === "DOCUMENT_EXTRACTION" ? "DOCUMENT" : method === "DERIVED" ? "DERIVED" : value ? "CANONICAL_PROFILE" : "UNRESOLVED", sourceReference: conflict ? "State identification and benefits award letter disagree" : method === "DOCUMENT_EXTRACTION" ? "Reviewed supporting document" : method === "DERIVED" ? "Calculated from reviewed information" : value ? "Canonical client profile" : null, populationMethod: conflict ? "UNRESOLVED" : method, reviewState: conflict ? "CONFLICT" : expired ? "EXPIRED" : consent ? "AWAITING_CONFIRMATION" : unresolvedSeedFields.has(field.fieldKey) ? "NEEDS_ANSWER" : value ? "AUTOMATICALLY_COMPLETED" : "NOT_APPLICABLE", validationState: conflict ? "CONFLICT" : expired ? "EXPIRED" : consent || unresolvedSeedFields.has(field.fieldKey) ? "MISSING" : "VALID" };
  }) },
  documents: { create: [conflictDoc, jordanIdDoc, jordanIncomeDoc, jordanHomelessnessDoc].map((document) => ({ uploadedDocumentId: document.id, selected: true, authorized: true })) },
} });

async function packetFor(clientCase, program, status, version, unresolvedConflicts) {
  const source = await db.clientCase.findUniqueOrThrow({ where: { id: clientCase.id }, include: { householdMembers: true, documents: { include: { extractedFields: true } } } });
  const requirements = program.requirements.map((requirement) => {
    const matching = source.documents.filter((document) => document.documentCategory === requirement.category);
    const state = unresolvedConflicts && requirement.category === "INCOME" ? "CONFLICT" : !matching.length ? "MISSING" : matching.some((document) => document.extractedFields.some((field) => field.reviewStatus === "PENDING")) ? "NEEDS_REVIEW" : "SATISFIED";
    const reason = state === "SATISFIED" ? "A current supporting document is present and its extracted information has been reviewed." : state === "CONFLICT" ? "This information differs across the case record or supporting documents and needs staff review." : state === "NEEDS_REVIEW" ? "A related document contains information that still needs staff review." : `No ${requirement.name.toLowerCase()} has been added.`;
    return { id: requirement.id, name: requirement.name, category: requirement.category, isRequired: requirement.isRequired, state, reason };
  });
  const generatedAt = new Date();
  const snapshot = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    caseReference: source.referenceNumber,
    client: { legalName: source.legalName, preferredName: source.preferredName, dateOfBirth: source.dateOfBirth?.toISOString().slice(0, 10) ?? null, preferredLanguage: source.preferredLanguage, currentLivingSituation: source.currentLivingSituation, accessibilityNeeds: source.accessibilityNeeds },
    household: source.householdMembers.map((member) => ({ name: member.name, relationship: member.relationship, dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? null, monthlyIncomeCents: member.monthlyIncomeCents, incomeSource: member.incomeSource })),
    program: { name: program.name, organization: program.organization, description: program.description, fictional: true },
    requirements,
    documents: source.documents.map((document) => ({ originalFilename: document.originalFilename, fileType: document.fileType, category: document.documentCategory, uploadedAt: document.uploadedAt.toISOString(), expirationDate: document.expirationDate?.toISOString() ?? null, processingStatus: document.processingStatus, reviewedFields: document.extractedFields.map((field) => ({ fieldName: field.fieldName, value: field.reviewedValue ?? field.extractedValue, reviewStatus: field.reviewStatus, sourcePage: field.sourcePage, sourceText: field.sourceText })) })),
    reviewItems: unresolvedConflicts ? [{ code: "LEGAL_NAME_CONFLICT", severity: "BLOCKING", message: "A legal name differs between the case record and a supporting document.", categories: ["IDENTITY", "INCOME"] }] : [],
    missingInformation: requirements.filter((requirement) => requirement.isRequired && requirement.state !== "SATISFIED").map((requirement) => `${requirement.name}: ${requirement.reason}`),
  };
  const packet = await db.applicationPacket.create({ data: {
    referenceNumber: `PKT-${clientCase.referenceNumber.slice(-4)}-V${version}`, clientCaseId: clientCase.id, housingProgramId: program.id,
    status, version, unresolvedConflicts, generatedAt, snapshotJson: JSON.stringify(snapshot), submittedAt: status !== "DRAFT" ? new Date() : null,
    approvedById: status === "APPROVED" ? reviewer.id : null,
    fields: { create: [
      { fieldKey: "legal_name", fieldLabel: "Legal name", value: clientCase.legalName, sourceType: "CASE_RECORD", sourceReference: clientCase.referenceNumber, reviewStatus: status === "APPROVED" ? "APPROVED" : "PENDING", reviewerId: status === "APPROVED" ? reviewer.id : null },
      { fieldKey: "living_situation", fieldLabel: "Current living situation", value: clientCase.currentLivingSituation ?? "", sourceType: "CASE_RECORD", sourceReference: clientCase.referenceNumber, reviewStatus: status === "APPROVED" ? "APPROVED" : "PENDING", reviewerId: status === "APPROVED" ? reviewer.id : null },
    ] },
  } });
  if (status === "APPROVED") {
    for (const requirement of requirements.filter((item) => item.isRequired && item.state !== "SATISFIED")) await db.requirementOverride.create({ data: { packetId: packet.id, requirementId: requirement.id, requirementName: requirement.name, reviewerId: reviewer.id, note: "Synthetic seed override documented after human review." } });
  }
  return packet;
}

const readyPacket = await packetFor(cases[1], north, "READY_FOR_REVIEW", 1, 0);
const conflictPacket = await packetFor(cases[2], family, "NEEDS_CORRECTION", 1, 1);
const approvedPacket = await packetFor(cases[3], harbor, "APPROVED", 2, 0);

await db.reviewNote.create({ data: { packetId: conflictPacket.id, authorId: reviewer.id, note: "Please confirm the legal name shown on the income document before resubmission." } });

for (const clientCase of cases) {
  await db.auditEvent.create({ data: { organizationId: ownerOrganization.id, userId: caseworker.id, clientCaseId: clientCase.id, action: "CASE_CREATED", entityType: "ClientCase", entityId: clientCase.id, metadata: "Synthetic demonstration case created" } });
}
await db.auditEvent.createMany({ data: [
  { organizationId: ownerOrganization.id, userId: caseworker.id, clientCaseId: cases[1].id, action: "DOCUMENT_UPLOADED", entityType: "UploadedDocument", entityId: idDoc.id, metadata: "Identity document processed by mock provider" },
  { organizationId: ownerOrganization.id, userId: caseworker.id, clientCaseId: cases[2].id, action: "DOCUMENT_UPLOADED", entityType: "UploadedDocument", entityId: conflictDoc.id, metadata: "Income document processed by mock provider" },
  { organizationId: ownerOrganization.id, userId: caseworker.id, clientCaseId: cases[1].id, action: "PACKET_GENERATED", entityType: "ApplicationPacket", entityId: readyPacket.id, metadata: "Packet version 1 generated" },
  { organizationId: ownerOrganization.id, userId: reviewer.id, clientCaseId: cases[2].id, action: "PACKET_RETURNED", entityType: "ApplicationPacket", entityId: conflictPacket.id, metadata: "Returned with correction note" },
  { organizationId: ownerOrganization.id, userId: reviewer.id, clientCaseId: cases[3].id, action: "PACKET_APPROVED", entityType: "ApplicationPacket", entityId: approvedPacket.id, metadata: "Packet version 2 approved" },
] });

console.log("Seeded synthetic demonstration data and accounts.");
await db.$disconnect();
