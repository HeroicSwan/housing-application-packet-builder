"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { canAccessCase, requireRole } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

const caseSchema = z.object({
  legalName: z.string().trim().min(2, "Legal name is required."),
  preferredName: z.string().trim().max(120).optional(),
  dateOfBirth: z.union([z.literal(""), z.string().date("Enter a valid date of birth.")]).optional(),
  preferredLanguage: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  currentLivingSituation: z.string().trim().max(1000).optional(),
  accessibilityNeeds: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export type CaseFormState = { message: string; errors: Record<string, string[]>; values: Record<string, string> };
const formValues = (formData: FormData) => Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string").map(([key, value]) => [key, String(value)]));

export async function createCaseAction(_previousState: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole(["CASEWORKER"]);
  const raw = formValues(formData); const parsed = caseSchema.safeParse(raw);
  if (!parsed.success) return { message: "Correct the highlighted fields and try again.", errors: parsed.error.flatten().fieldErrors as Record<string, string[]>, values: raw };
  const input = parsed.data;
  const count = await db.clientCase.count();
  const referenceNumber = `HAP-${new Date().getFullYear()}-${String(count + 41).padStart(4, "0")}`;
  const clientCase = await db.clientCase.create({ data: {
    ...input, email: input.email || null, dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T12:00:00Z`) : null,
    assignedCaseworkerId: user.id, referenceNumber, status: "INTAKE",
  } });
  await recordAudit({ userId: user.id, clientCaseId: clientCase.id, action: "CASE_CREATED", entityType: "ClientCase", entityId: clientCase.id, metadata: "Case created from intake form" });
  redirect(`/cases/${clientCase.id}`);
}

export async function updateCaseAction(clientCaseId: string, _previousState: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const raw = formValues(formData); const parsed = caseSchema.safeParse(raw);
  if (!parsed.success) return { message: "Correct the highlighted fields and try again.", errors: parsed.error.flatten().fieldErrors as Record<string, string[]>, values: raw };
  const input = parsed.data;
  await db.clientCase.update({ where: { id: clientCaseId }, data: { ...input, email: input.email || null, dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T12:00:00Z`) : null } });
  await recordAudit({ userId: user.id, clientCaseId, action: "CASE_UPDATED", entityType: "ClientCase", entityId: clientCaseId, metadata: "Client information updated" });
  revalidatePath(`/cases/${clientCaseId}`);
  return { message: "Client information saved.", errors: {}, values: raw };
}

export async function addHouseholdMemberAction(clientCaseId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  const relationship = z.string().trim().min(2).max(80).parse(formData.get("relationship"));
  const date = z.union([z.literal(""), z.string().date()]).parse(String(formData.get("dateOfBirth") ?? ""));
  const income = z.union([z.literal(""), z.coerce.number().nonnegative().max(1_000_000)]).parse(String(formData.get("monthlyIncome") ?? ""));
  const member = await db.householdMember.create({ data: { clientCaseId, name, relationship, dateOfBirth: date ? new Date(`${date}T12:00:00Z`) : null, monthlyIncomeCents: income === "" ? null : Math.round(income * 100), incomeSource: z.string().trim().max(120).parse(String(formData.get("incomeSource") ?? "")) || null } });
  await recordAudit({ userId: user.id, clientCaseId, action: "HOUSEHOLD_MEMBER_ADDED", entityType: "HouseholdMember", entityId: member.id, metadata: "Household member added" });
  revalidatePath(`/cases/${clientCaseId}`);
}

export async function addIncomeRecordAction(clientCaseId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]); if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const householdMemberId = z.string().trim().parse(String(formData.get("householdMemberId") ?? "")) || null;
  if (householdMemberId && !(await db.householdMember.count({ where: { id: householdMemberId, clientCaseId } }))) throw new Error("Household member does not belong to this case.");
  const frequency = z.enum(["HOURLY", "WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "ANNUAL", "ONE_TIME"]).parse(formData.get("frequency"));
  const amount = z.coerce.number().positive().max(10_000_000).parse(formData.get("amount"));
  const start = z.union([z.literal(""), z.string().date()]).parse(String(formData.get("startDate") ?? "")); const end = z.union([z.literal(""), z.string().date()]).parse(String(formData.get("endDate") ?? ""));
  const record = await db.incomeRecord.create({ data: { clientCaseId, householdMemberId, earnerName: z.string().trim().min(2).max(160).parse(formData.get("earnerName")), sourceName: z.string().trim().min(2).max(160).parse(formData.get("sourceName")), incomeType: z.enum(["EARNED", "BENEFIT", "OTHER"]).parse(formData.get("incomeType")), amountCents: Math.round(amount * 100), frequency, hoursPerWeek: frequency === "HOURLY" ? z.coerce.number().positive().max(168).parse(String(formData.get("hoursPerWeek") || "40")) : null, weeksPerYear: frequency === "HOURLY" ? z.coerce.number().positive().max(52).parse(String(formData.get("weeksPerYear") || "52")) : null, startDate: start ? new Date(`${start}T12:00:00Z`) : null, endDate: end ? new Date(`${end}T12:00:00Z`) : null, isGross: formData.get("isGross") === "on" } });
  await recordAudit({ userId: user.id, clientCaseId, action: "INCOME_RECORD_ADDED", entityType: "IncomeRecord", entityId: record.id, metadata: `${record.incomeType} income with ${record.frequency} frequency added; amount not logged` }); revalidatePath(`/cases/${clientCaseId}/household`);
}

export async function selectProgramAction(clientCaseId: string, formData: FormData) {
  const user = await requireRole(["CASEWORKER"]);
  if (!(await canAccessCase(user, clientCaseId))) throw new Error("Case access denied.");
  const selectedProgramId = z.string().min(1).parse(formData.get("programId"));
  const [clientCase] = await Promise.all([db.clientCase.findUniqueOrThrow({ where: { id: clientCaseId } }), db.housingProgram.findFirstOrThrow({ where: { id: selectedProgramId, isActive: true } })]);
  if (clientCase.status === "APPROVED" || clientCase.status === "ARCHIVED") throw new Error("Approved or archived cases cannot change programs.");
  await db.clientCase.update({ where: { id: clientCaseId }, data: { selectedProgramId, status: clientCase.status === "INTAKE" ? "COLLECTING_DOCUMENTS" : clientCase.status } });
  await recordAudit({ userId: user.id, clientCaseId, action: "PROGRAM_SELECTED", entityType: "HousingProgram", entityId: selectedProgramId, metadata: "Housing program selected" });
  revalidatePath(`/cases/${clientCaseId}`);
  redirect(`/cases/${clientCaseId}/application`);
}
