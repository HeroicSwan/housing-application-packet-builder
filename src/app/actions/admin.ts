"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { inspectAcroForm } from "@/lib/applications/acroform";
import { putObject } from "@/lib/storage";
import { sanitizeFilename, validateFileSignature, validateUpload } from "@/lib/validation/files";
import { env } from "@/lib/env";
import { encryptText } from "@/lib/security/encryption";
import { emailConfigured, sendEmail } from "@/lib/email";
import { sha256 } from "@/lib/security/encryption";

const optionalText = z.preprocess((value) => typeof value === "string" ? value : "", z.string().trim().max(1000).transform((value) => value || null));
const programSchema = z.object({
  name: z.string().trim().min(3, "Program name is required.").max(120),
  organization: z.string().trim().min(3, "Organization is required.").max(120),
  description: z.string().trim().min(10, "Add a useful program description.").max(2000),
  incomeLimitNotes: optionalText,
  contactInformation: optionalText,
  householdRestrictions: optionalText,
  accessibilityNotes: optionalText,
});
const requirementSchema = z.object({
  name: z.string().trim().min(3).max(160),
  category: z.enum(["IDENTITY", "INCOME", "RESIDENCY", "HOUSEHOLD", "DISABILITY", "HOMELESSNESS_VERIFICATION", "OTHER"]),
  description: z.string().trim().min(5).max(1000),
  isRequired: z.boolean(),
  expirationPeriodDays: z.number().int().positive().max(3650).nullable(),
  requiredFieldName: z.string().trim().max(100).nullable(),
  applicableHouseholdRules: z.enum(["HAS_ADDITIONAL_HOUSEHOLD_MEMBERS"]).nullable(),
});

function parseProgram(formData: FormData) {
  return programSchema.parse(Object.fromEntries(formData));
}
function parseRequirement(formData: FormData) {
  const expiration = String(formData.get("expirationPeriodDays") ?? "").trim();
  return requirementSchema.parse({ name: formData.get("name"), category: formData.get("category"), description: formData.get("description"), isRequired: formData.get("isRequired") === "on", expirationPeriodDays: expiration ? Number(expiration) : null, requiredFieldName: String(formData.get("requiredFieldName") ?? "").trim() || null, applicableHouseholdRules: String(formData.get("applicableHouseholdRules") ?? "") || null });
}

export async function createProgramAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]); const input = parseProgram(formData);
  const program = await db.$transaction(async (tx) => {
    const created = await tx.housingProgram.create({ data: { ...input, isActive: true, fictional: true } });
    await tx.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_CREATED", entityType: "HousingProgram", entityId: created.id, metadata: "Fictional demonstration program created" } }); return created;
  });
  redirect(`/admin/programs/${program.id}`);
}

export async function updateProgramAction(programId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]); const input = parseProgram(formData); const isActive = formData.get("isActive") === "on";
  await db.$transaction([
    db.housingProgram.update({ where: { id: programId }, data: { ...input, isActive } }),
    db.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_UPDATED", entityType: "HousingProgram", entityId: programId, metadata: "Program details updated" } }),
  ]); revalidatePath(`/admin/programs/${programId}`); revalidatePath("/admin/programs");
}

export async function addRequirementAction(programId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]); const input = parseRequirement(formData); await db.housingProgram.findUniqueOrThrow({ where: { id: programId } });
  await db.$transaction(async (tx) => {
    const requirement = await tx.programRequirement.create({ data: { ...input, housingProgramId: programId } });
    await tx.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_REQUIREMENT_ADDED", entityType: "ProgramRequirement", entityId: requirement.id, metadata: "Program requirement added" } });
  }); revalidatePath(`/admin/programs/${programId}`);
}

export async function updateRequirementAction(programId: string, requirementId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]); const input = parseRequirement(formData); const existing = await db.programRequirement.findFirstOrThrow({ where: { id: requirementId, housingProgramId: programId } });
  await db.$transaction([
    db.programRequirement.update({ where: { id: existing.id }, data: input }),
    db.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_REQUIREMENT_UPDATED", entityType: "ProgramRequirement", entityId: existing.id, metadata: "Program requirement updated" } }),
  ]); revalidatePath(`/admin/programs/${programId}`);
}

export async function deleteRequirementAction(programId: string, requirementId: string) {
  const user = await requireRole(["ADMIN"]); const existing = await db.programRequirement.findFirstOrThrow({ where: { id: requirementId, housingProgramId: programId } });
  await db.$transaction([
    db.programRequirement.delete({ where: { id: existing.id } }),
    db.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_REQUIREMENT_REMOVED", entityType: "ProgramRequirement", entityId: existing.id, metadata: "Program requirement removed; existing packet snapshots are unchanged" } }),
  ]); revalidatePath(`/admin/programs/${programId}`);
}

export async function createApplicationTemplateAction(programId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  await db.housingProgram.findUniqueOrThrow({ where: { id: programId } });
  const name = z.string().trim().min(3).max(160).parse(formData.get("name"));
  const description = z.string().trim().min(5).max(1000).parse(formData.get("description"));
  const templateType = z.enum(["GENERATED_PDF", "ACROFORM"]).parse(formData.get("templateType"));
  const outputFilenamePattern = z.string().trim().min(5).max(160).parse(formData.get("outputFilenamePattern"));
  const file = formData.get("file");
  let sourceStorageKey: string | null = null;
  let discovered: Awaited<ReturnType<typeof inspectAcroForm>> | null = null;
  if (templateType === "ACROFORM") {
    if (!(file instanceof File) || !file.size) throw new Error("Choose an agency AcroForm PDF.");
    const validation = validateUpload(file, env.MAX_UPLOAD_MB); if (!validation.valid) throw new Error(validation.error);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type !== "application/pdf" || !validateFileSignature(bytes, file.type)) throw new Error("The agency template must be a valid PDF.");
    discovered = await inspectAcroForm(bytes);
    const safeName = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    sourceStorageKey = (await putObject(`templates/${programId}/${safeName}`, bytes, file.type)).key;
  }
  const version = (await db.applicationTemplate.aggregate({ where: { housingProgramId: programId, name }, _max: { version: true } }))._max.version ?? 0;
  const template = await db.$transaction(async (tx) => {
    const created = await tx.applicationTemplate.create({ data: { housingProgramId: programId, name, description, version: version + 1, status: "DRAFT", templateType, sourceStorageKey, outputFilenamePattern } });
    if (discovered) await tx.applicationTemplateField.createMany({ data: discovered.fields.map((field) => ({ templateId: created.id, fieldKey: field.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), displayLabel: field.name, fieldType: field.type, required: false, pageNumber: 1, section: "Agency form", displayOrder: field.displayOrder, pdfFieldName: field.name, staffGuidance: "Map this agency field to a canonical application value or mark it for staff entry." })) });
    await tx.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_CREATED", entityType: "ApplicationTemplate", entityId: created.id, metadata: `${templateType} template created with ${discovered?.fields.length ?? 0} discovered field(s)` } });
    return created;
  });
  redirect(`/admin/templates/${template.id}`);
}

export async function updateApplicationTemplateFieldAction(templateId: string, fieldId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  if (template.status !== "DRAFT") throw new Error("Published template versions are immutable. Create a new version to make changes.");
  const field = await db.applicationTemplateField.findFirstOrThrow({ where: { id: fieldId, templateId } });
  const data = {
    displayLabel: z.string().trim().min(1).max(160).parse(formData.get("displayLabel")),
    fieldType: z.enum(["TEXT", "DATE", "CURRENCY", "BOOLEAN", "SELECT", "REPEATING_GROUP", "SIGNATURE"]).parse(formData.get("fieldType")),
    required: formData.get("required") === "on",
    canonicalFieldPath: z.string().trim().max(160).parse(String(formData.get("canonicalFieldPath") ?? "")) || null,
    section: z.string().trim().min(1).max(120).parse(formData.get("section")),
    staffGuidance: z.string().trim().max(500).parse(String(formData.get("staffGuidance") ?? "")) || null,
  };
  await db.$transaction([db.applicationTemplateField.update({ where: { id: field.id }, data }), db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_FIELD_UPDATED", entityType: "ApplicationTemplateField", entityId: field.id, metadata: "Template field mapping updated" } })]);
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function addApplicationTemplateFieldAction(templateId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { _count: { select: { fields: true } } } });
  if (template.status !== "DRAFT") throw new Error("Published template versions are immutable.");
  const fieldKey = z.string().trim().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/).parse(formData.get("fieldKey"));
  const created = await db.applicationTemplateField.create({ data: { templateId, fieldKey, displayLabel: z.string().trim().min(1).max(160).parse(formData.get("displayLabel")), fieldType: z.enum(["TEXT", "DATE", "CURRENCY", "BOOLEAN", "SELECT", "REPEATING_GROUP", "SIGNATURE"]).parse(formData.get("fieldType")), required: formData.get("required") === "on", canonicalFieldPath: z.string().trim().max(160).parse(String(formData.get("canonicalFieldPath") ?? "")) || null, pageNumber: 1, section: z.string().trim().min(1).max(120).parse(formData.get("section")), displayOrder: template._count.fields + 1, staffGuidance: z.string().trim().max(500).parse(String(formData.get("staffGuidance") ?? "")) || null } });
  await db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_FIELD_ADDED", entityType: "ApplicationTemplateField", entityId: created.id, metadata: "Generated template field added" } });
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function publishApplicationTemplateAction(templateId: string) {
  const user = await requireRole(["ADMIN"]);
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { fields: true } });
  if (template.status !== "DRAFT" || !template.fields.length) throw new Error("Only a draft template with fields can be published.");
  await db.$transaction([db.applicationTemplate.update({ where: { id: templateId }, data: { status: "ACTIVE", publishedAt: new Date() } }), db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_PUBLISHED", entityType: "ApplicationTemplate", entityId: templateId, metadata: `Version ${template.version} published and locked` } })]);
  revalidatePath(`/admin/templates/${templateId}`); revalidatePath(`/admin/programs/${template.housingProgramId}`);
}

export async function cloneApplicationTemplateVersionAction(templateId: string) {
  const user = await requireRole(["ADMIN"]);
  const source = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { fields: true } });
  const version = (await db.applicationTemplate.aggregate({ where: { housingProgramId: source.housingProgramId, name: source.name }, _max: { version: true } }))._max.version ?? source.version;
  const clone = await db.$transaction(async (tx) => {
    const created = await tx.applicationTemplate.create({ data: { housingProgramId: source.housingProgramId, name: source.name, description: source.description, version: version + 1, status: "DRAFT", templateType: source.templateType, sourceStorageKey: source.sourceStorageKey, sourceFilePath: source.sourceFilePath, outputFilenamePattern: source.outputFilenamePattern, supersedesTemplateId: source.id } });
    await tx.applicationTemplateField.createMany({ data: source.fields.map((field) => ({ templateId: created.id, fieldKey: field.fieldKey, displayLabel: field.displayLabel, fieldType: field.fieldType, required: field.required, canonicalFieldPath: field.canonicalFieldPath, pageNumber: field.pageNumber, section: field.section, displayOrder: field.displayOrder, validationRules: field.validationRules, conditionalRules: field.conditionalRules, formattingRules: field.formattingRules, pdfFieldName: field.pdfFieldName, positionInformation: field.positionInformation, staffGuidance: field.staffGuidance, optionsJson: field.optionsJson })) });
    await tx.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_VERSION_CREATED", entityType: "ApplicationTemplate", entityId: created.id, metadata: `Version ${created.version} cloned from version ${source.version}` } });
    return created;
  });
  redirect(`/admin/templates/${clone.id}`);
}

export async function addSubmissionDestinationAction(programId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const type = z.enum(["EMAIL", "API", "PORTAL_API"]).parse(formData.get("type"));
  const endpoint = z.string().trim().parse(String(formData.get("endpoint") ?? "")) || null;
  if (type !== "EMAIL" && (!endpoint || !z.string().url().safeParse(endpoint).success || (!endpoint.startsWith("https://") && process.env.NODE_ENV === "production"))) throw new Error("API destinations require a valid HTTPS endpoint.");
  const recipient = z.string().trim().parse(String(formData.get("recipient") ?? "")) || null;
  if (type === "EMAIL" && !z.string().email().safeParse(recipient).success) throw new Error("Email destinations require a valid recipient.");
  const authToken = z.string().trim().max(1000).parse(String(formData.get("authToken") ?? ""));
  const destination = await db.submissionDestination.create({ data: { housingProgramId: programId, name: z.string().trim().min(2).max(120).parse(formData.get("name")), type, endpoint, recipient, configEncrypted: authToken ? encryptText(JSON.stringify({ authToken })) : null } });
  await db.auditEvent.create({ data: { userId: user.id, action: "SUBMISSION_DESTINATION_ADDED", entityType: "SubmissionDestination", entityId: destination.id, metadata: `${type} destination configured; credentials not logged` } });
  revalidatePath(`/admin/programs/${programId}`);
}

export async function createStaffUserAction(formData: FormData) {
  const admin = await requireRole(["ADMIN"]); if (!emailConfigured()) throw new Error("SMTP must be configured before inviting staff users.");
  const email = z.string().email().parse(String(formData.get("email") ?? "").trim().toLowerCase()); const name = z.string().trim().min(2).max(120).parse(formData.get("name")); const role = z.enum(["CASEWORKER", "REVIEWER", "ADMIN"]).parse(formData.get("role")); const token = crypto.randomBytes(32).toString("base64url"); const temporaryPassword = crypto.randomBytes(32).toString("base64url");
  const user = await db.$transaction(async (tx) => { const created = await tx.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(temporaryPassword, 12) } }); await tx.passwordResetToken.create({ data: { userId: created.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }); await tx.auditEvent.create({ data: { userId: admin.id, action: "STAFF_USER_INVITED", entityType: "User", entityId: created.id, metadata: `Staff role ${role} invited; credentials not logged` } }); return created; });
  await sendEmail({ to: user.email, subject: "Set up your Housing Packet Builder account", text: `You were invited to the Housing Application Packet Builder. Set your password within 24 hours: ${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}` }); revalidatePath("/admin/users");
}

export async function updateStaffUserAction(userId: string, formData: FormData) {
  const admin = await requireRole(["ADMIN"]); if (userId === admin.id && formData.get("isActive") !== "on") throw new Error("You cannot deactivate your own account."); const role = z.enum(["CASEWORKER", "REVIEWER", "ADMIN"]).parse(formData.get("role")); const isActive = formData.get("isActive") === "on";
  await db.$transaction([db.user.update({ where: { id: userId }, data: { role, isActive } }), db.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }), db.auditEvent.create({ data: { userId: admin.id, action: "STAFF_ACCESS_UPDATED", entityType: "User", entityId: userId, metadata: `Role ${role}; active ${isActive}; existing sessions revoked` } })]); revalidatePath("/admin/users");
}
