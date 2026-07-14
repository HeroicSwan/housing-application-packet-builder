import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildCanonicalApplicationData, createOrRefreshDraft } from "@/lib/applications/service";
import { generateApplicationOutput } from "@/lib/applications/output";
import { generateSupportingPacketPdf } from "@/lib/applications/pdf";
import { normalizeMonthlyIncome } from "@/lib/applications/income";
import { encryptText } from "@/lib/security/encryption";
import { deliverApplication } from "@/lib/submissions";

const RUN = `ADVERSARIAL-${Date.now()}`;
const CASE_COUNT = Math.max(1, Number(process.env.REPLAY_CASE_COUNT ?? 31));
const HOUSEHOLD_MEMBER_COUNT = 8;
const INCOME_RECORDS_PER_CASE = 9;
const DOCUMENTS_PER_CASE = 8;
const fixturePath = "fixtures/jordan-state-identification.pdf";

const names = [
  "Avery O'Connor", "Beyoncé Rivera", "Cruz-Santos Lee", "D'Angelo Brooks", "Eli Zhang", "Fatima Al-Hassan", "Gio O'Neil", "Hana Müller",
];

let stressUser: { id: string } | undefined;
let program: { id: string } | undefined;
let template: { id: string; version: number } | undefined;
let providerServer: ReturnType<typeof createServer> | undefined;
const providerRequests: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
let destination: { id: string } | undefined;
const caseIds: string[] = [];
const draftIds: string[] = [];

const templateFields = [
  ["applicant_name", "Applicant legal name", "TEXT", true, "client.legalName", "Applicant.Name"],
  ["applicant_dob", "Date of birth", "DATE", true, "client.dateOfBirth", "Applicant.DOB"],
  ["applicant_phone", "Phone", "TEXT", true, "client.phone", "Applicant.Phone"],
  ["applicant_email", "Email", "TEXT", true, "client.email", "Applicant.Email"],
  ["household_size", "Household size", "NUMBER", true, "derived.householdSize", "Household.Size"],
  ["monthly_income", "Total monthly income", "CURRENCY", true, "derived.totalMonthlyIncome", "Income.Monthly"],
  ["consent_acknowledgment", "Applicant consent confirmed", "BOOLEAN", true, "client.consentConfirmed", "Consent.Yes"],
  ["signature", "Electronic signature", "SIGNATURE", true, null, "Signature.Typed"],
] as const;

function dateFor(index: number) {
  return new Date(Date.UTC(1980 + (index % 20), index % 12, (index % 27) + 1));
}

function incomeRecords(caseId: string, index: number) {
  const active = [
    { sourceName: "Night shift wages", incomeType: "EARNED", amountCents: 1850 + index * 3, frequency: "HOURLY", hoursPerWeek: 32, weeksPerYear: 52 },
    { sourceName: "Weekend catering", incomeType: "EARNED", amountCents: 42000 + index * 100, frequency: "WEEKLY", hoursPerWeek: null, weeksPerYear: null },
    { sourceName: "Temp agency", incomeType: "EARNED", amountCents: 76000 + index * 250, frequency: "BIWEEKLY", hoursPerWeek: null, weeksPerYear: null },
    { sourceName: "Cleaning contract", incomeType: "EARNED", amountCents: 88000 + index * 200, frequency: "SEMIMONTHLY", hoursPerWeek: null, weeksPerYear: null },
    { sourceName: "Seasonal stipend", incomeType: "EARNED", amountCents: 3600000 + index * 5000, frequency: "ANNUAL", hoursPerWeek: null, weeksPerYear: null },
    { sourceName: "Housing benefit", incomeType: "BENEFIT", amountCents: 62000 + index * 150, frequency: "MONTHLY", hoursPerWeek: null, weeksPerYear: null },
    { sourceName: "Child support", incomeType: "OTHER", amountCents: 28000 + index * 100, frequency: "MONTHLY", hoursPerWeek: null, weeksPerYear: null },
    { sourceName: "Settlement payment", incomeType: "OTHER", amountCents: 120000 + index * 1000, frequency: "ONE_TIME", hoursPerWeek: null, weeksPerYear: null, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
  ];
  return [
    ...active.map((item) => ({ clientCaseId: caseId, earnerName: names[index % names.length], isGross: true, ...item })),
    { clientCaseId: caseId, earnerName: names[index % names.length], sourceName: "Ended job", incomeType: "EARNED", amountCents: 999999, frequency: "MONTHLY", isGross: true, startDate: new Date("2025-01-01"), endDate: new Date("2026-06-30") },
  ];
}

async function createEvidence(caseId: string, index: number) {
  const expired = index % 7 === 0;
  const expiration = expired ? new Date("2025-12-31") : new Date("2027-12-31");
  await db.uploadedDocument.create({
    data: {
      clientCaseId: caseId, originalFilename: `synthetic-${index + 1}-identity.pdf`, safeFilename: `synthetic-${index + 1}-identity.pdf`, fileType: "application/pdf", storagePath: fixturePath, storageProvider: "LOCAL", documentCategory: "IDENTITY", processingStatus: "COMPLETED", uploadedById: stressUser!.id, expirationDate: expiration,
      extractedFields: { create: [
        { fieldName: "legal_name", extractedValue: names[index % names.length], confidence: 0.99, sourcePage: 1, sourceText: `Name: ${names[index % names.length]}`, reviewStatus: "APPROVED", reviewerId: stressUser!.id, reviewedAt: new Date() },
        { fieldName: "date_of_birth", extractedValue: dateFor(index).toISOString().slice(0, 10), confidence: 0.98, sourcePage: 1, sourceText: "DOB: synthetic", reviewStatus: "APPROVED", reviewerId: stressUser!.id, reviewedAt: new Date() },
        { fieldName: "identification_type", extractedValue: "State identification card", confidence: 0.98, sourcePage: 1, sourceText: "Document type: State ID", reviewStatus: "APPROVED", reviewerId: stressUser!.id, reviewedAt: new Date() },
        { fieldName: "identification_expiration_date", extractedValue: expiration.toISOString().slice(0, 10), confidence: 0.98, sourcePage: 1, sourceText: "Expires: synthetic", reviewStatus: "APPROVED", reviewerId: stressUser!.id, reviewedAt: new Date() },
      ] },
    },
  });
  if (index % 5 === 0) {
    await db.uploadedDocument.create({
      data: {
        clientCaseId: caseId, originalFilename: `synthetic-${index + 1}-conflicting-scan.pdf`, safeFilename: `synthetic-${index + 1}-conflicting-scan.pdf`, fileType: "application/pdf", storagePath: fixturePath, storageProvider: "LOCAL", documentCategory: "OTHER", processingStatus: "COMPLETED", uploadedById: stressUser!.id,
        extractedFields: { create: [{ fieldName: "date_of_birth", extractedValue: new Date(dateFor(index).getTime() + 86400000).toISOString().slice(0, 10), confidence: 0.61, sourcePage: 1, sourceText: "DOB: conflicting synthetic value", reviewStatus: "PENDING" }] },
      },
    });
  }
  const documents = ["INCOME", "BENEFITS", "RESIDENCY", "HOUSEHOLD", "HOMELESSNESS_VERIFICATION", "OTHER"];
  for (const category of documents) await db.uploadedDocument.create({ data: { clientCaseId: caseId, originalFilename: `synthetic-${index + 1}-${category.toLowerCase()}.pdf`, safeFilename: `synthetic-${index + 1}-${category.toLowerCase()}.pdf`, fileType: "application/pdf", storagePath: fixturePath, storageProvider: "LOCAL", documentCategory: category, processingStatus: "COMPLETED", uploadedById: stressUser!.id } });
}

describe("adversarial synthetic month replay", () => {
  beforeAll(async () => {
    stressUser = await db.user.create({ data: { name: "Synthetic Stress Runner", email: `${RUN.toLowerCase()}@example.test`, passwordHash: "not-used", role: "ADMIN" } });
    program = await db.housingProgram.create({ data: { name: `${RUN} Program`, organization: "Synthetic QA Agency", description: "Synthetic stress-test program", isActive: true } });
    template = await db.applicationTemplate.create({
      data: {
        housingProgramId: program.id, name: `${RUN} AcroForm`, description: "Synthetic adversarial AcroForm", version: 1, status: "ACTIVE", publishedAt: new Date(), templateType: "ACROFORM", sourceFilePath: "fixtures/family-pathways-agency-acroform.pdf", outputFilenamePattern: "synthetic-{client}-v{version}.pdf",
        fields: { create: templateFields.map(([fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pdfFieldName], displayOrder) => ({ fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pdfFieldName, formattingRules: fieldKey === "consent_acknowledgment" ? "YES_NO" : null, pageNumber: 1, section: "Synthetic stress test", displayOrder })) },
      },
    });

    providerServer = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => { providerRequests.push({ headers: request.headers, body: Buffer.concat(chunks).toString("utf8") }); response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ id: "SYNTHETIC-ACCEPTED-001", message: "Synthetic provider accepted packet" })); });
    });
    await new Promise<void>((resolve) => providerServer!.listen(0, "127.0.0.1", resolve));
    const port = (providerServer.address() as AddressInfo).port;
    destination = await db.submissionDestination.create({ data: { housingProgramId: program.id, name: `${RUN} Provider Stub`, type: "PORTAL_API", endpoint: `http://127.0.0.1:${port}/submit`, configEncrypted: encryptText(JSON.stringify({ authToken: "synthetic-token" })) } });

    for (let index = 0; index < CASE_COUNT; index += 1) {
      const legalName = names[index % names.length];
      const clientCase = await db.clientCase.create({ data: { referenceNumber: `${RUN}-${String(index + 1).padStart(2, "0")}`, assignedCaseworkerId: stressUser.id, selectedProgramId: program.id, status: "COLLECTING_DOCUMENTS", legalName, preferredName: legalName.split(" ")[0], dateOfBirth: dateFor(index), phone: `(555) 01${String(index).padStart(2, "03")}`, email: `synthetic-${index + 1}@example.test`, mailingAddress: `${index + 1} Synthetic Way, Testville, NY 1000${index % 10}`, currentLivingSituation: index % 3 === 0 ? "Emergency motel" : index % 3 === 1 ? "Unsheltered" : "Staying temporarily with family", preferredLanguage: index % 4 === 0 ? "Spanish" : "English", veteranStatus: index % 6 === 0 ? "Yes" : "No", emergencyContact: `Synthetic Contact ${index + 1}`, contactPermission: true } });
      caseIds.push(clientCase.id);
      await db.householdMember.createMany({ data: Array.from({ length: HOUSEHOLD_MEMBER_COUNT - 1 }, (_, memberIndex) => ({ clientCaseId: clientCase.id, name: `Household ${index + 1}-${memberIndex + 1}`, relationship: memberIndex === 0 ? "Partner" : "Child", dateOfBirth: new Date(Date.UTC(2005 + memberIndex, memberIndex % 12, memberIndex + 1)), monthlyIncomeCents: 0 })) });
      await db.incomeRecord.createMany({ data: incomeRecords(clientCase.id, index) });
      await createEvidence(clientCase.id, index);
    }
  }, 120000);

  afterAll(async () => {
    if (providerServer) await new Promise<void>((resolve) => providerServer!.close(() => resolve()));
    if (caseIds.length) await db.clientCase.deleteMany({ where: { id: { in: caseIds } } });
    if (program) await db.applicationTemplate.deleteMany({ where: { housingProgramId: program.id } });
    if (program) await db.submissionDestination.deleteMany({ where: { housingProgramId: program.id } });
    if (program) await db.housingProgram.delete({ where: { id: program.id } });
    if (stressUser) { await db.auditEvent.deleteMany({ where: { userId: stressUser.id } }); await db.user.delete({ where: { id: stressUser.id } }); }
    await db.$disconnect();
  });

  it("replays 31 complex cases through review, versioning, PDF generation, and provider delivery", async () => {
    const started = performance.now();
    let conflictCases = 0;
    let expiredCases = 0;
    let outputBytes = 0;
    const generatedFiles: string[] = [];

    const discovered = await PDFDocument.load(await (await import("node:fs/promises")).readFile("fixtures/family-pathways-agency-acroform.pdf"));
    expect(discovered.getForm().getFields()).toHaveLength(8);

    for (let index = 0; index < CASE_COUNT; index += 1) {
      const caseId = caseIds[index];
      let draft = await createOrRefreshDraft(caseId, template!.id, stressUser!.id);
      const initialStatus = draft.status;
      expect(initialStatus).toBe("NEEDS_INFORMATION");
      const initialData = await buildCanonicalApplicationData(caseId);
      expect(initialData.household).toHaveLength(HOUSEHOLD_MEMBER_COUNT - 1);
      const expectedTotals = (await db.incomeRecord.findMany({ where: { clientCaseId: caseId } })).filter((record) => !record.endDate || record.endDate >= new Date()).reduce((totals, record) => { totals[record.incomeType as "EARNED" | "BENEFIT" | "OTHER"] += normalizeMonthlyIncome(record); return totals; }, { EARNED: 0, BENEFIT: 0, OTHER: 0 });
      expect(Number(initialData.values["finances.monthlyEarnedIncome"].value)).toBe(Math.round(expectedTotals.EARNED));
      expect(Number(initialData.values["finances.monthlyBenefitsIncome"].value)).toBe(Math.round(expectedTotals.BENEFIT));
      expect(Number(initialData.values["finances.otherIncome"].value)).toBe(Math.round(expectedTotals.OTHER));

      if (index % 5 === 0) { conflictCases += 1; await db.extractedField.updateMany({ where: { uploadedDocument: { clientCaseId: caseId }, reviewStatus: "PENDING" }, data: { reviewStatus: "REJECTED", reviewerId: stressUser!.id, reviewedAt: new Date() } }); }
      if (index % 7 === 0) { expiredCases += 1; await db.uploadedDocument.updateMany({ where: { clientCaseId: caseId, documentCategory: "IDENTITY" }, data: { expirationDate: new Date("2027-12-31") } }); await db.extractedField.updateMany({ where: { uploadedDocument: { clientCaseId: caseId, documentCategory: "IDENTITY" }, fieldName: "identification_expiration_date" }, data: { extractedValue: "2027-12-31", reviewedValue: "2027-12-31" } }); }

      await db.clientCase.update({ where: { id: caseId }, data: { consentConfirmedAt: new Date() } });
      await db.applicationSignature.create({ data: { draftId: draft.id, signedName: names[index % names.length], signerEmail: `signer-${index + 1}@example.test`, attestationVersion: "synthetic-stress-v1", capturedById: stressUser!.id } });
      await db.consentRecord.create({ data: { clientCaseId: caseId, draftId: draft.id, consentType: "DOCUMENT_RELEASE", version: "synthetic-stress-v1", granted: true, recordedById: stressUser!.id } });
      draft = await createOrRefreshDraft(caseId, template!.id, stressUser!.id);
      expect(draft.status).toBe("READY_TO_GENERATE");
      await db.applicationDraft.update({ where: { id: draft.id }, data: { status: "APPROVED", generatedAt: new Date(), generationVersion: 1 } });
      draftIds.push(draft.id);

      const output = await generateApplicationOutput(draft.id);
      outputBytes += output.bytes.byteLength;
      const pdf = await PDFDocument.load(output.bytes);
      const form = pdf.getForm();
      expect(form.getTextField("Applicant.Name").getText()).toBe(names[index % names.length]);
      expect(form.getTextField("Household.Size").getText()).toBe(String(HOUSEHOLD_MEMBER_COUNT));
      expect(form.getTextField("Signature.Typed").getText()).toBe(names[index % names.length]);
      expect(form.getCheckBox("Consent.Yes").isChecked()).toBe(true);
      if (index === 0 || index === CASE_COUNT - 1) { const outputName = `output/stress/${RUN.toLowerCase()}-${index + 1}.pdf`; await mkdir("output/stress", { recursive: true }); await writeFile(outputName, output.bytes); generatedFiles.push(outputName); }

      const packet = await generateSupportingPacketPdf({ applicationBytes: output.bytes, applicationReference: `${RUN}-${index + 1}`, applicantName: names[index % names.length], documents: Array.from({ length: DOCUMENTS_PER_CASE }, (_, documentIndex) => ({ name: `synthetic-${documentIndex + 1}.pdf`, category: "OTHER", bytes: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]) })), missingDocuments: [] });
      expect((await PDFDocument.load(packet)).getPageCount()).toBeGreaterThan(1);
    }

    const version2 = await db.applicationTemplate.create({ data: { housingProgramId: program!.id, name: `${RUN} AcroForm`, description: "Synthetic adversarial AcroForm v2", version: 2, status: "ACTIVE", publishedAt: new Date(), templateType: "ACROFORM", sourceFilePath: "fixtures/family-pathways-agency-acroform.pdf", outputFilenamePattern: "synthetic-{client}-v{version}.pdf", supersedesTemplateId: template!.id, fields: { create: templateFields.map(([fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pdfFieldName], displayOrder) => ({ fieldKey, displayLabel, fieldType, required, canonicalFieldPath, pdfFieldName, formattingRules: fieldKey === "consent_acknowledgment" ? "YES_NO" : null, pageNumber: 1, section: "Synthetic stress test v2", displayOrder })) } } });
    const upgradedDraft = await createOrRefreshDraft(caseIds[1], version2.id, stressUser!.id);
    expect(upgradedDraft.templateVersion).toBe(2);
    expect((await db.applicationDraft.findUniqueOrThrow({ where: { id: draftIds[1] } })).templateVersion).toBe(1);

    const deliverableDraftId = draftIds[0];
    const firstDelivery = await deliverApplication(deliverableDraftId, destination!.id);
    const secondDelivery = await deliverApplication(deliverableDraftId, destination!.id);
    expect(firstDelivery.status).toBe("SUBMITTED");
    expect(secondDelivery.status).toBe("SUBMITTED");
    expect(secondDelivery.attempts).toBe(2);
    expect(providerRequests).toHaveLength(2);
    expect(providerRequests[0].headers["idempotency-key"]).toBe(providerRequests[1].headers["idempotency-key"]);
    const providerPayload = JSON.parse(providerRequests[0].body) as { applicationPdfBase64: string; supportingPacketPdfBase64: string };
    expect((await PDFDocument.load(Buffer.from(providerPayload.applicationPdfBase64, "base64"))).getPageCount()).toBeGreaterThan(0);
    expect((await PDFDocument.load(Buffer.from(providerPayload.supportingPacketPdfBase64, "base64"))).getPageCount()).toBeGreaterThan(1);

    const report = { runId: RUN, syntheticCases: CASE_COUNT, householdMembersPerCase: HOUSEHOLD_MEMBER_COUNT, incomeRecordsPerCase: INCOME_RECORDS_PER_CASE, documentsPerCase: DOCUMENTS_PER_CASE, conflictCases, expiredCases, generatedApplications: CASE_COUNT, totalApplicationBytes: outputBytes, providerDeliveries: providerRequests.length, idempotencyKeyStable: true, templateVersionUpgradeVerified: true, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), generatedFiles };
    await mkdir("output/stress", { recursive: true });
    await writeFile("output/stress/synthetic-month-replay.json", JSON.stringify(report, null, 2));
    expect(report.syntheticCases).toBe(CASE_COUNT);
    expect(report.conflictCases).toBe(Math.floor((CASE_COUNT - 1) / 5) + 1);
    expect(report.expiredCases).toBe(Math.floor((CASE_COUNT - 1) / 7) + 1);
    expect(report.totalApplicationBytes).toBeGreaterThan(100000);
  }, 180000);
});
