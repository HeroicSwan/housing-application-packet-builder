"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";

const keySchema = z.string().trim().min(2).max(80).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores.");
const fieldTypeSchema = z.enum(["TEXT", "LONG_TEXT", "DATE", "NUMBER", "CURRENCY", "BOOLEAN", "SELECT", "MULTI_SELECT"]);

function optionalJson(value: FormDataEntryValue | null, fallback: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { throw new Error("Configuration JSON is invalid."); }
}

export async function createAgencyFieldDefinitionAction(formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const data = { organizationId: user.organizationId, key: keySchema.parse(formData.get("key")), label: z.string().trim().min(2).max(160).parse(formData.get("label")), fieldType: fieldTypeSchema.parse(formData.get("fieldType")), required: formData.get("required") === "on", validationRules: JSON.stringify(optionalJson(formData.get("validationRules"), {})), optionsJson: JSON.stringify(optionalJson(formData.get("optionsJson"), [])), helpText: z.string().trim().max(500).parse(String(formData.get("helpText") ?? "")) || null };
  await db.agencyFieldDefinition.create({ data });
  revalidatePath("/admin/agency-configuration");
}

export async function deleteAgencyFieldDefinitionAction(definitionId: string) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  await db.agencyFieldDefinition.delete({ where: { id: definitionId, organizationId: user.organizationId } });
  revalidatePath("/admin/agency-configuration");
}

export async function createWorkflowDefinitionAction(formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const stages = optionalJson(formData.get("stagesJson"), []) as unknown;
  if (!Array.isArray(stages)) throw new Error("Workflow stages must be a JSON array.");
  await db.workflowDefinition.create({ data: { organizationId: user.organizationId, key: keySchema.parse(formData.get("key")), name: z.string().trim().min(2).max(160).parse(formData.get("name")), stagesJson: JSON.stringify(stages) } });
  revalidatePath("/admin/agency-configuration");
}

export async function createDocumentProfileAction(formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const validationRules = optionalJson(formData.get("validationRules"), {});
  await db.documentProfile.create({ data: { organizationId: user.organizationId, key: keySchema.parse(formData.get("key")), name: z.string().trim().min(2).max(160).parse(formData.get("name")), category: z.string().trim().min(1).max(120).parse(formData.get("category")), extractionPrompt: z.string().trim().max(4000).parse(String(formData.get("extractionPrompt") ?? "")) || null, required: formData.get("required") === "on", validationRules: JSON.stringify(validationRules) } });
  revalidatePath("/admin/agency-configuration");
}

export async function importAgencyConfigurationAction(formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const raw = z.string().trim().max(2_000_000).parse(formData.get("configuration"));
  let config: { fieldDefinitions?: unknown; workflows?: unknown; documentProfiles?: unknown };
  try { config = JSON.parse(raw) as typeof config; } catch { throw new Error("Configuration export is not valid JSON."); }
  const fields = z.array(z.object({ key: keySchema, label: z.string().min(2).max(160), fieldType: fieldTypeSchema, required: z.boolean().optional(), validationRules: z.unknown().optional(), optionsJson: z.unknown().optional(), helpText: z.string().max(500).nullable().optional() })).default([]).parse(config.fieldDefinitions);
  const workflows = z.array(z.object({ key: keySchema, name: z.string().min(2).max(160), stages: z.array(z.unknown()) })).default([]).parse(config.workflows);
  const profiles = z.array(z.object({ key: keySchema, name: z.string().min(2).max(160), category: z.string().min(1).max(120), extractionPrompt: z.string().max(4000).nullable().optional(), required: z.boolean().optional(), validationRules: z.unknown().optional() })).default([]).parse(config.documentProfiles);
  await db.$transaction(async (tx) => {
    for (const field of fields) await tx.agencyFieldDefinition.upsert({ where: { organizationId_key: { organizationId: user.organizationId, key: field.key } }, create: { organizationId: user.organizationId, key: field.key, label: field.label, fieldType: field.fieldType, required: field.required ?? false, validationRules: JSON.stringify(field.validationRules ?? {}), optionsJson: JSON.stringify(field.optionsJson ?? []), helpText: field.helpText ?? null }, update: { label: field.label, fieldType: field.fieldType, required: field.required ?? false, validationRules: JSON.stringify(field.validationRules ?? {}), optionsJson: JSON.stringify(field.optionsJson ?? []), helpText: field.helpText ?? null } });
    for (const workflow of workflows) await tx.workflowDefinition.upsert({ where: { organizationId_key: { organizationId: user.organizationId, key: workflow.key } }, create: { organizationId: user.organizationId, key: workflow.key, name: workflow.name, stagesJson: JSON.stringify(workflow.stages) }, update: { name: workflow.name, stagesJson: JSON.stringify(workflow.stages) } });
    for (const profile of profiles) await tx.documentProfile.upsert({ where: { organizationId_key: { organizationId: user.organizationId, key: profile.key } }, create: { organizationId: user.organizationId, key: profile.key, name: profile.name, category: profile.category, extractionPrompt: profile.extractionPrompt ?? null, required: profile.required ?? false, validationRules: JSON.stringify(profile.validationRules ?? {}) }, update: { name: profile.name, category: profile.category, extractionPrompt: profile.extractionPrompt ?? null, required: profile.required ?? false, validationRules: JSON.stringify(profile.validationRules ?? {}) } });
  });
  revalidatePath("/admin/agency-configuration");
}
