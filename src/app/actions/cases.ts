"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { caseStatuses, encodeCaseTags, normalizeCaseEmail, normalizeCaseName, normalizeCasePhone } from "@/lib/cases/management";
import { invalidateCaseDrafts } from "@/lib/applications/integrity";
import { runWithOrganization } from "@/lib/tenant-context";

const optionalDate = z.union([z.literal(""), z.string().date()]);
const optionalMoney = z.union([z.literal(""), z.coerce.number().nonnegative().max(10_000_000)]);
const optionalPositive = z.union([z.literal(""), z.coerce.number().positive()]);
const versionSchema = z.coerce.number().int().nonnegative();
const caseSchema = z.object({
  legalName: z.string().trim().min(2, "Legal name is required.").max(160),
  preferredName: z.string().trim().max(120).optional(),
  dateOfBirth: optionalDate.optional(),
  preferredLanguage: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  currentLivingSituation: z.string().trim().max(1000).optional(),
  accessibilityNeeds: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(4000).optional(),
  duplicateAcknowledged: z.string().optional(),
});

const householdSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(80),
  householdRole: z.enum(["SPOUSE_PARTNER", "DEPENDENT_CHILD", "ADULT_DEPENDENT", "ROOMMATE", "CAREGIVER", "OTHER"]).default("OTHER"),
  dateOfBirth: optionalDate.default(""),
  sharedCustody: z.boolean(),
  custodyPercent: z.union([z.literal(""), z.coerce.number().int().min(1).max(100)]).default(""),
  custodyNotes: z.string().trim().max(1000).default(""),
  sameAddressAsClient: z.boolean(),
  address: z.string().trim().max(500).default(""),
  monthlyIncome: optionalMoney.default(""),
  incomeSource: z.string().trim().max(120).default(""),
}).superRefine((value, context) => {
  if (value.sharedCustody && value.custodyPercent === "") context.addIssue({ code: "custom", path: ["custodyPercent"], message: "Enter the custody percentage used by the organization." });
  if (!value.sameAddressAsClient && !value.address) context.addIssue({ code: "custom", path: ["address"], message: "Enter this household member's address." });
});

const incomeSchema = z.object({
  householdMemberId: z.string().trim(),
  earnerName: z.string().trim().min(2).max(160),
  sourceName: z.string().trim().min(2).max(160),
  incomeType: z.enum(["EARNED", "BENEFIT", "OTHER"]),
  incomeSubtype: z.enum(["WAGES", "SELF_EMPLOYMENT", "GIG_WORK", "UNEMPLOYMENT", "SSI", "SSDI", "TANF", "CHILD_SUPPORT", "ALIMONY", "PENSION", "VETERANS_BENEFIT", "RENTAL", "OTHER"]),
  amount: z.coerce.number().positive().max(10_000_000),
  frequency: z.enum(["HOURLY", "DAILY", "WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME", "IRREGULAR"]),
  hoursPerWeek: optionalPositive,
  daysPerWeek: z.union([z.literal(""), z.coerce.number().positive().max(7)]),
  weeksPerYear: z.union([z.literal(""), z.coerce.number().positive().max(52)]),
  averagingPeriodMonths: z.union([z.literal(""), z.coerce.number().int().positive().max(120)]),
  monthlyOvertime: optionalMoney,
  monthlyOverride: optionalMoney,
  overrideReason: z.string().trim().max(1000),
  startDate: optionalDate,
  endDate: optionalDate,
  isVariable: z.boolean(),
  isGross: z.boolean(),
}).superRefine((value, context) => {
  if (value.frequency === "HOURLY" && value.hoursPerWeek === "") context.addIssue({ code: "custom", path: ["hoursPerWeek"], message: "Hours per week are required for hourly income." });
  if (value.frequency === "DAILY" && value.daysPerWeek === "") context.addIssue({ code: "custom", path: ["daysPerWeek"], message: "Days per week are required for daily income." });
  if (["ONE_TIME", "IRREGULAR"].includes(value.frequency) && value.averagingPeriodMonths === "" && (!value.startDate || !value.endDate)) context.addIssue({ code: "custom", path: ["averagingPeriodMonths"], message: "Enter an averaging period or a complete start and end date." });
  if (value.monthlyOverride !== "" && value.overrideReason.length < 10) context.addIssue({ code: "custom", path: ["overrideReason"], message: "Explain the documented reason for the monthly override." });
  if (value.startDate && value.endDate && value.endDate < value.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date." });
});

export type CaseFormState = {
  message: string;
  errors: Record<string, string[]>;
  values: Record<string, string>;
  duplicates?: { id: string; referenceNumber: string; legalName: string }[];
  conflict?: boolean;
};

const formValues = (formData: FormData) => Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string").map(([key, value]) => [key, String(value)]));
const dateValue = (value: string | undefined) => value ? new Date(`${value}T12:00:00Z`) : null;
const moneyValue = (value: number | "") => value === "" ? null : Math.round(value * 100);
const nullable = (value: string | undefined) => value || null;

async function requireCaseEditor(clientCaseId: string) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "ADMIN"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  return user;
}

async function requireUpdated(result: { count: number }) {
  if (result.count !== 1) throw new Error("This record changed in another session. Refresh the page before trying again.");
}

async function allowedCaseStatuses(organizationId: string) {
  const workflow = await db.workflowDefinition.findFirst({ where: { organizationId, key: "case_management", active: true } });
  let stages: unknown = [];
  if (workflow) {
    try { stages = JSON.parse(workflow.stagesJson) as unknown; } catch { stages = []; }
  }
  const custom = Array.isArray(stages) ? stages.flatMap((stage) => typeof stage === "object" && stage !== null && "key" in stage && typeof stage.key === "string" ? [stage.key] : []) : [];
  return new Set<string>([...caseStatuses, ...custom]);
}

export async function createCaseAction(_previousState: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "ADMIN"]));
  const raw = formValues(formData);
  const parsed = caseSchema.safeParse(raw);
  if (!parsed.success) return { message: "Correct the highlighted fields and try again.", errors: parsed.error.flatten().fieldErrors as Record<string, string[]>, values: raw };
  const input = parsed.data;
  const normalizedLegalName = normalizeCaseName(input.legalName);
  const normalizedEmail = normalizeCaseEmail(input.email);
  const normalizedPhone = normalizeCasePhone(input.phone);
  const birthDate = dateValue(input.dateOfBirth);
  const duplicateSignals = [
    ...(birthDate ? [{ normalizedLegalName, dateOfBirth: birthDate }] : []),
    ...(normalizedEmail ? [{ normalizedEmail }] : []),
    ...(normalizedPhone ? [{ normalizedPhone }] : []),
  ];
  const duplicates = duplicateSignals.length ? await db.clientCase.findMany({ where: { OR: duplicateSignals }, select: { id: true, referenceNumber: true, legalName: true }, take: 5, orderBy: { updatedAt: "desc" } }) : [];
  if (duplicates.length && input.duplicateAcknowledged !== "true") return { message: "Possible duplicate cases found. Review the matches, then confirm if this is a different person.", errors: {}, values: raw, duplicates };
  const referenceNumber = `HAP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const clientCase = await db.clientCase.create({ data: {
    legalName: input.legalName,
    preferredName: nullable(input.preferredName),
    dateOfBirth: birthDate,
    preferredLanguage: nullable(input.preferredLanguage),
    phone: nullable(input.phone),
    email: nullable(input.email),
    currentLivingSituation: nullable(input.currentLivingSituation),
    accessibilityNeeds: nullable(input.accessibilityNeeds),
    notes: nullable(input.notes),
    normalizedLegalName,
    normalizedEmail,
    normalizedPhone,
    assignedCaseworkerId: user.id,
    referenceNumber,
    status: "INTAKE",
  } });
  await recordAudit({ userId: user.id, clientCaseId: clientCase.id, action: "CASE_CREATED", entityType: "ClientCase", entityId: clientCase.id, metadata: duplicates.length ? "Case created after duplicate warning acknowledgement" : "Case created from intake form" });
  redirect(`/cases/${clientCase.id}`);
}

export async function updateCaseAction(clientCaseId: string, _previousState: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireCaseEditor(clientCaseId);
  const raw = formValues(formData);
  const parsed = caseSchema.safeParse(raw);
  const version = versionSchema.safeParse(raw.recordVersion);
  if (!parsed.success || !version.success) return { message: "Correct the highlighted fields and try again.", errors: parsed.success ? { recordVersion: ["Refresh the page and try again."] } : parsed.error.flatten().fieldErrors as Record<string, string[]>, values: raw };
  const input = parsed.data;
  const updated = await runWithOrganization(user.organizationId, () => db.clientCase.updateMany({ where: { id: clientCaseId, recordVersion: version.data }, data: {
    legalName: input.legalName,
    preferredName: nullable(input.preferredName),
    dateOfBirth: dateValue(input.dateOfBirth),
    preferredLanguage: nullable(input.preferredLanguage),
    phone: nullable(input.phone),
    email: nullable(input.email),
    currentLivingSituation: nullable(input.currentLivingSituation),
    accessibilityNeeds: nullable(input.accessibilityNeeds),
    notes: nullable(input.notes),
    normalizedLegalName: normalizeCaseName(input.legalName),
    normalizedEmail: normalizeCaseEmail(input.email),
    normalizedPhone: normalizeCasePhone(input.phone),
    recordVersion: { increment: 1 },
  } }));
  if (updated.count !== 1) return { message: "This case changed in another session. Refresh before saving again.", errors: {}, values: raw, conflict: true };
  await runWithOrganization(user.organizationId, async () => {
    await invalidateCaseDrafts(clientCaseId, user.id, "Applicant information changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: "CASE_UPDATED", entityType: "ClientCase", entityId: clientCaseId, metadata: "Client information updated" });
  });
  revalidatePath(`/cases/${clientCaseId}`);
  return { message: "Client information saved.", errors: {}, values: { ...raw, recordVersion: String(version.data + 1) } };
}

export async function updateCustomCaseFieldsAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const definitions = await db.agencyFieldDefinition.findMany({ where: { organizationId: user.organizationId, active: true } });
  const values = definitions.map((definition) => ({ definition, value: (definition.fieldType === "MULTI_SELECT" ? formData.getAll(`custom_${definition.key}`).map(String).filter(Boolean).join("|") : String(formData.get(`custom_${definition.key}`) ?? "")).trim() }));
  for (const item of values) {
    if (item.definition.required && !item.value) throw new Error(`${item.definition.label} is required.`);
    if (!item.value || !item.definition.validationRules) continue;
    try {
      const rules = JSON.parse(item.definition.validationRules) as { minLength?: number; pattern?: string };
      if (rules.minLength && item.value.length < rules.minLength) throw new Error(`${item.definition.label} is shorter than the configured minimum.`);
      if (rules.pattern && !new RegExp(rules.pattern).test(item.value)) throw new Error(`${item.definition.label} does not match its configured format.`);
    } catch (error) { if (error instanceof Error && !error.message.includes("JSON")) throw error; throw new Error(`The validation rule for ${item.definition.label} is invalid.`); }
  }
  await runWithOrganization(user.organizationId, async () => {
    for (const item of values) await db.caseFieldValue.upsert({ where: { clientCaseId_definitionId: { clientCaseId, definitionId: item.definition.id } }, create: { clientCaseId, definitionId: item.definition.id, value: item.value || null }, update: { value: item.value || null, sourceType: "STAFF_ENTRY" } });
    await invalidateCaseDrafts(clientCaseId, user.id, "Agency-specific case information changed.");
    await recordAudit({ userId: user.id, clientCaseId, action: "CUSTOM_CASE_FIELDS_UPDATED", entityType: "ClientCase", entityId: clientCaseId, metadata: "Agency-specific case fields updated; values not logged" });
  });
  revalidatePath(`/cases/${clientCaseId}/client`);
  revalidatePath(`/cases/${clientCaseId}/application`);
}

export async function updateCaseManagementAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const status = z.string().trim().min(1).max(80).parse(formData.get("status"));
  if (!(await allowedCaseStatuses(user.organizationId)).has(status)) throw new Error("This status is not configured for the agency workflow.");
  const dueDate = optionalDate.parse(String(formData.get("dueDate") ?? ""));
  const internalNote = z.string().trim().max(8000).parse(String(formData.get("internalNote") ?? ""));
  const tags = encodeCaseTags(z.string().max(1000).parse(String(formData.get("tags") ?? "")));
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  await requireUpdated(await db.clientCase.updateMany({ where: { id: clientCaseId, recordVersion, status: { not: "ARCHIVED" } }, data: { status, dueDate: dateValue(dueDate), internalNote: internalNote || null, tags, recordVersion: { increment: 1 } } }));
  await recordAudit({ userId: user.id, clientCaseId, action: "CASE_MANAGEMENT_UPDATED", entityType: "ClientCase", entityId: clientCaseId, metadata: "Case status, due date, internal note, or tags updated; note content not logged" });
  revalidatePath(`/cases/${clientCaseId}`);
  revalidatePath("/cases");
}

export async function archiveCaseAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  const reason = z.string().trim().min(3).max(500).parse(formData.get("archiveReason"));
  const clientCase = await db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId }, select: { status: true } });
  if (clientCase.status === "ARCHIVED") throw new Error("Case is already archived.");
  await requireUpdated(await db.clientCase.updateMany({ where: { id: clientCaseId, recordVersion, status: clientCase.status }, data: { statusBeforeArchive: clientCase.status, status: "ARCHIVED", archivedAt: new Date(), archiveReason: reason, recordVersion: { increment: 1 } } }));
  await recordAudit({ userId: user.id, clientCaseId, action: "CASE_ARCHIVED", entityType: "ClientCase", entityId: clientCaseId, metadata: "Case archived; reason retained on case and omitted from audit metadata" });
  revalidatePath(`/cases/${clientCaseId}`);
  revalidatePath("/cases");
}

export async function reopenCaseAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  const clientCase = await db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId }, select: { status: true, statusBeforeArchive: true } });
  if (clientCase.status !== "ARCHIVED") throw new Error("Only archived cases can be reopened.");
  const status = (await allowedCaseStatuses(user.organizationId)).has(clientCase.statusBeforeArchive ?? "") ? clientCase.statusBeforeArchive! : "INTAKE";
  await requireUpdated(await db.clientCase.updateMany({ where: { id: clientCaseId, recordVersion, status: "ARCHIVED" }, data: { status, statusBeforeArchive: null, archivedAt: null, archiveReason: null, recordVersion: { increment: 1 } } }));
  await recordAudit({ userId: user.id, clientCaseId, action: "CASE_REOPENED", entityType: "ClientCase", entityId: clientCaseId, metadata: "Archived case reopened" });
  revalidatePath(`/cases/${clientCaseId}`);
  revalidatePath("/cases");
}

export async function transferCaseAssignmentAction(clientCaseId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const assignedCaseworkerId = z.string().min(1).parse(formData.get("assignedCaseworkerId"));
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  const [clientCase, assignee] = await Promise.all([
    db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId }, select: { assignedCaseworkerId: true } }),
    db.user.findFirst({ where: { id: assignedCaseworkerId, isActive: true, role: { in: ["CASEWORKER", "ADMIN"] } }, select: { id: true } }),
  ]);
  if (!assignee) throw new Error("Select an active caseworker in this organization.");
  await requireUpdated(await db.clientCase.updateMany({ where: { id: clientCaseId, recordVersion, assignedCaseworkerId: clientCase.assignedCaseworkerId }, data: { assignedCaseworkerId: assignee.id, recordVersion: { increment: 1 } } }));
  await recordAudit({ userId: user.id, clientCaseId, action: "CASE_ASSIGNMENT_TRANSFERRED", entityType: "ClientCase", entityId: clientCaseId, metadata: `Assignment transferred from user ${clientCase.assignedCaseworkerId} to user ${assignee.id}` });
  revalidatePath(`/cases/${clientCaseId}`);
  revalidatePath("/cases");
}

function householdInput(formData: FormData) {
  return householdSchema.parse({
    ...formValues(formData),
    sharedCustody: formData.get("sharedCustody") === "on",
    sameAddressAsClient: formData.has("sameAddressAsClient") || formData.has("address")
      ? formData.get("sameAddressAsClient") === "on"
      : true,
  });
}

function householdData(input: z.infer<typeof householdSchema>) {
  return {
    name: input.name,
    relationship: input.relationship,
    householdRole: input.householdRole,
    dateOfBirth: dateValue(input.dateOfBirth),
    sharedCustody: input.sharedCustody,
    custodyPercent: input.sharedCustody && input.custodyPercent !== "" ? input.custodyPercent : null,
    custodyNotes: input.sharedCustody ? input.custodyNotes || null : null,
    sameAddressAsClient: input.sameAddressAsClient,
    address: input.sameAddressAsClient ? null : input.address,
    monthlyIncomeCents: moneyValue(input.monthlyIncome),
    incomeSource: input.incomeSource || null,
  };
}

export async function addHouseholdMemberAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  await runWithOrganization(user.organizationId, async () => {
    const member = await db.householdMember.create({ data: { clientCaseId, ...householdData(householdInput(formData)) } });
    await invalidateCaseDrafts(clientCaseId, user.id, "Household composition changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: "HOUSEHOLD_MEMBER_ADDED", entityType: "HouseholdMember", entityId: member.id, metadata: "Active household member added" });
  });
  revalidatePath(`/cases/${clientCaseId}/household`);
}

export async function updateHouseholdMemberAction(clientCaseId: string, householdMemberId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  await runWithOrganization(user.organizationId, async () => {
    await requireUpdated(await db.householdMember.updateMany({ where: { id: householdMemberId, clientCaseId, recordVersion, isActive: true }, data: { ...householdData(householdInput(formData)), recordVersion: { increment: 1 } } }));
    await invalidateCaseDrafts(clientCaseId, user.id, "Household details changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: "HOUSEHOLD_MEMBER_UPDATED", entityType: "HouseholdMember", entityId: householdMemberId, metadata: "Household member details updated" });
  });
  revalidatePath(`/cases/${clientCaseId}/household`);
}

export async function removeHouseholdMemberAction(clientCaseId: string, householdMemberId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  const removalReason = z.string().trim().min(3).max(500).parse(formData.get("removalReason"));
  await runWithOrganization(user.organizationId, async () => {
    await requireUpdated(await db.householdMember.updateMany({ where: { id: householdMemberId, clientCaseId, recordVersion, isActive: true }, data: { isActive: false, removedAt: new Date(), removalReason, recordVersion: { increment: 1 } } }));
    await invalidateCaseDrafts(clientCaseId, user.id, "Household composition changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: "HOUSEHOLD_MEMBER_REMOVED", entityType: "HouseholdMember", entityId: householdMemberId, metadata: "Household member moved to historical records; reason not logged" });
  });
  revalidatePath(`/cases/${clientCaseId}/household`);
}

export async function restoreHouseholdMemberAction(clientCaseId: string, householdMemberId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  await runWithOrganization(user.organizationId, async () => {
    await requireUpdated(await db.householdMember.updateMany({ where: { id: householdMemberId, clientCaseId, recordVersion, isActive: false }, data: { isActive: true, removedAt: null, removalReason: null, recordVersion: { increment: 1 } } }));
    await invalidateCaseDrafts(clientCaseId, user.id, "Household composition changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: "HOUSEHOLD_MEMBER_RESTORED", entityType: "HouseholdMember", entityId: householdMemberId, metadata: "Historical household member restored" });
  });
  revalidatePath(`/cases/${clientCaseId}/household`);
}

function incomeInput(formData: FormData) {
  return incomeSchema.parse({ ...formValues(formData), isVariable: formData.get("isVariable") === "on", isGross: formData.get("isGross") === "on" });
}

function incomeData(input: z.infer<typeof incomeSchema>, userId: string) {
  const override = moneyValue(input.monthlyOverride);
  return {
    householdMemberId: input.householdMemberId || null,
    earnerName: input.earnerName,
    sourceName: input.sourceName,
    incomeType: input.incomeType,
    incomeSubtype: input.incomeSubtype,
    amountCents: Math.round(input.amount * 100),
    frequency: input.frequency,
    hoursPerWeek: input.frequency === "HOURLY" && input.hoursPerWeek !== "" ? input.hoursPerWeek : null,
    daysPerWeek: input.frequency === "DAILY" && input.daysPerWeek !== "" ? input.daysPerWeek : null,
    weeksPerYear: ["HOURLY", "DAILY"].includes(input.frequency) && input.weeksPerYear !== "" ? input.weeksPerYear : null,
    isVariable: input.isVariable,
    averagingPeriodMonths: input.averagingPeriodMonths === "" ? null : input.averagingPeriodMonths,
    monthlyOvertimeCents: moneyValue(input.monthlyOvertime),
    monthlyOverrideCents: override,
    overrideReason: override === null ? null : input.overrideReason,
    overrideById: override === null ? null : userId,
    overrideAt: override === null ? null : new Date(),
    startDate: dateValue(input.startDate),
    endDate: dateValue(input.endDate),
    isGross: input.isGross,
  };
}

async function assertActiveHouseholdMember(clientCaseId: string, householdMemberId: string) {
  if (!(await db.householdMember.count({ where: { id: householdMemberId, clientCaseId, isActive: true } }))) throw new Error("Household member does not belong to the active household for this case.");
}

export async function addIncomeRecordAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const input = incomeInput(formData);
  await runWithOrganization(user.organizationId, async () => {
    if (input.householdMemberId) await assertActiveHouseholdMember(clientCaseId, input.householdMemberId);
    const record = await db.incomeRecord.create({ data: { clientCaseId, ...incomeData(input, user.id) } });
    await invalidateCaseDrafts(clientCaseId, user.id, "Income information changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: input.monthlyOverride === "" ? "INCOME_RECORD_ADDED" : "INCOME_OVERRIDE_RECORDED", entityType: "IncomeRecord", entityId: record.id, metadata: `${record.incomeType}/${record.incomeSubtype} income added; amounts and override reason not logged` });
  });
  revalidatePath(`/cases/${clientCaseId}/household`);
}

export async function updateIncomeRecordAction(clientCaseId: string, incomeRecordId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const input = incomeInput(formData);
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  await runWithOrganization(user.organizationId, async () => {
    if (input.householdMemberId) await assertActiveHouseholdMember(clientCaseId, input.householdMemberId);
    await requireUpdated(await db.incomeRecord.updateMany({ where: { id: incomeRecordId, clientCaseId, recordVersion }, data: { ...incomeData(input, user.id), recordVersion: { increment: 1 } } }));
    await invalidateCaseDrafts(clientCaseId, user.id, "Income information changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: input.monthlyOverride === "" ? "INCOME_RECORD_UPDATED" : "INCOME_OVERRIDE_RECORDED", entityType: "IncomeRecord", entityId: incomeRecordId, metadata: "Income details updated; amounts and override reason not logged" });
  });
  revalidatePath(`/cases/${clientCaseId}/household`);
}

export async function selectProgramAction(clientCaseId: string, formData: FormData) {
  const user = await requireCaseEditor(clientCaseId);
  const selectedProgramId = z.string().min(1).parse(formData.get("programId"));
  const recordVersion = versionSchema.parse(formData.get("recordVersion"));
  await runWithOrganization(user.organizationId, async () => {
    const [clientCase] = await Promise.all([db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId } }), db.housingProgram.findFirstOrThrow({ where: { id: selectedProgramId, isActive: true } })]);
    if (clientCase.status === "APPROVED" || clientCase.status === "ARCHIVED") throw new Error("Approved or archived cases cannot change programs.");
    await requireUpdated(await db.clientCase.updateMany({ where: { id: clientCaseId, recordVersion }, data: { selectedProgramId, status: clientCase.status === "INTAKE" ? "COLLECTING_DOCUMENTS" : clientCase.status, recordVersion: { increment: 1 } } }));
    await invalidateCaseDrafts(clientCaseId, user.id, "The selected housing program changed after signature or approval.");
    await recordAudit({ userId: user.id, clientCaseId, action: "PROGRAM_SELECTED", entityType: "HousingProgram", entityId: selectedProgramId, metadata: "Housing program selected" });
  });
  revalidatePath(`/cases/${clientCaseId}`);
  redirect(`/cases/${clientCaseId}/application`);
}
