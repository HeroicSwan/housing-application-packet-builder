"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { inspectAcroForm } from "@/lib/applications/acroform";
import { putObject } from "@/lib/storage";
import { inspectDocumentSafety, sanitizeFilename, validateFileSignature, validateUpload } from "@/lib/validation/files";
import { env } from "@/lib/env";
import { encryptText } from "@/lib/security/encryption";
import { emailConfiguredForOrganization, sendEmail } from "@/lib/email";
import { sha256 } from "@/lib/security/encryption";
import { approveCaseDeletion, cancelCaseDeletion, exportCaseData, requestCaseDeletion, setLegalHold } from "@/lib/data-lifecycle";
import { scanForMalware } from "@/lib/security/malware";
import { compareTemplateVersions, templateVersionFingerprint } from "@/lib/applications/template-compatibility";
import { runWithOrganization } from "@/lib/tenant-context";

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
  const user = activateOrganizationContext(await requireRole(["ADMIN"])); const input = parseProgram(formData);
  const program = await db.$transaction(async (tx) => {
    const created = await tx.housingProgram.create({ data: { ...input, isActive: true, fictional: true } });
    await tx.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_CREATED", entityType: "HousingProgram", entityId: created.id, metadata: "Fictional demonstration program created" } }); return created;
  });
  redirect(`/admin/programs/${program.id}`);
}

export async function updateProgramAction(programId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"])); const input = parseProgram(formData); const isActive = formData.get("isActive") === "on";
  await db.$transaction([
    db.housingProgram.update({ where: { id: programId }, data: { ...input, isActive } }),
    db.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_UPDATED", entityType: "HousingProgram", entityId: programId, metadata: "Program details updated" } }),
  ]); revalidatePath(`/admin/programs/${programId}`); revalidatePath("/admin/programs");
}

export async function addRequirementAction(programId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"])); const input = parseRequirement(formData); await db.housingProgram.findUniqueOrThrow({ where: { id: programId } });
  await db.$transaction(async (tx) => {
    const requirement = await tx.programRequirement.create({ data: { ...input, housingProgramId: programId } });
    await tx.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_REQUIREMENT_ADDED", entityType: "ProgramRequirement", entityId: requirement.id, metadata: "Program requirement added" } });
  }); revalidatePath(`/admin/programs/${programId}`);
}

export async function updateRequirementAction(programId: string, requirementId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"])); const input = parseRequirement(formData); const existing = await db.programRequirement.findFirstOrThrow({ where: { id: requirementId, housingProgramId: programId } });
  await db.$transaction([
    db.programRequirement.update({ where: { id: existing.id }, data: input }),
    db.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_REQUIREMENT_UPDATED", entityType: "ProgramRequirement", entityId: existing.id, metadata: "Program requirement updated" } }),
  ]); revalidatePath(`/admin/programs/${programId}`);
}

export async function deleteRequirementAction(programId: string, requirementId: string) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"])); const existing = await db.programRequirement.findFirstOrThrow({ where: { id: requirementId, housingProgramId: programId } });
  await db.$transaction([
    db.programRequirement.delete({ where: { id: existing.id } }),
    db.auditEvent.create({ data: { userId: user.id, action: "PROGRAM_REQUIREMENT_REMOVED", entityType: "ProgramRequirement", entityId: existing.id, metadata: "Program requirement removed; existing packet snapshots are unchanged" } }),
  ]); revalidatePath(`/admin/programs/${programId}`);
}

export async function createApplicationTemplateAction(programId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  await db.housingProgram.findUniqueOrThrow({ where: { id: programId } });
  const name = z.string().trim().min(3).max(160).parse(formData.get("name"));
  const description = z.string().trim().min(5).max(1000).parse(formData.get("description"));
  const templateType = z.enum(["GENERATED_PDF", "ACROFORM"]).parse(formData.get("templateType"));
  const outputFilenamePattern = z.string().trim().min(5).max(160).parse(formData.get("outputFilenamePattern"));
  const requiresAgencyAcceptance = formData.get("requiresAgencyAcceptance") === "on";
  const file = formData.get("file");
  let sourceStorageKey: string | null = null;
  let discovered: Awaited<ReturnType<typeof inspectAcroForm>> | null = null;
  if (templateType === "ACROFORM") {
    if (!(file instanceof File) || !file.size) throw new Error("Choose an agency AcroForm PDF.");
    const validation = validateUpload(file, env.MAX_UPLOAD_MB); if (!validation.valid) throw new Error(validation.error);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (file.type !== "application/pdf" || !validateFileSignature(bytes, file.type)) throw new Error("The agency template must be a valid PDF.");
    await inspectDocumentSafety(bytes, file.type);
    await scanForMalware(bytes);
    discovered = await inspectAcroForm(bytes);
    const safeName = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    sourceStorageKey = (await putObject(`templates/${programId}/${safeName}`, bytes, file.type)).key;
  }
  const version = (await db.applicationTemplate.aggregate({ where: { housingProgramId: programId, name }, _max: { version: true } }))._max.version ?? 0;
  const template = await db.$transaction(async (tx) => {
    const created = await tx.applicationTemplate.create({ data: { housingProgramId: programId, name, description, version: version + 1, status: "DRAFT", templateType, sourceStorageKey, outputFilenamePattern, requiresAgencyAcceptance, compatibilityKey: discovered ? sha256(JSON.stringify(discovered.fields.map((field) => ({ name: field.name, type: field.type })))) : null } });
    if (discovered) await tx.applicationTemplateField.createMany({ data: discovered.fields.map((field) => ({ templateId: created.id, fieldKey: field.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), displayLabel: field.name, fieldType: field.type, required: false, pageNumber: 1, section: "Agency form", displayOrder: field.displayOrder, pdfFieldName: field.name, staffGuidance: "Map this agency field to a canonical application value or mark it for staff entry." })) });
    await tx.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_CREATED", entityType: "ApplicationTemplate", entityId: created.id, metadata: `${templateType} template created with ${discovered?.fields.length ?? 0} discovered field(s)` } });
    return created;
  });
  redirect(`/admin/templates/${template.id}`);
}

export async function recordTemplateSandboxTestAction(templateId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const status = z.enum(["PASS", "FAIL"]).parse(formData.get("status"));
  const reference = z.string().trim().min(3).max(200).parse(formData.get("reference"));
  const summary = z.string().trim().min(20).max(2000).parse(formData.get("summary"));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  await db.$transaction([
    db.applicationTemplate.update({ where: { id: template.id }, data: { sandboxTestStatus: status, sandboxTestedAt: new Date(), sandboxTestReference: reference, sandboxTestSummary: summary } }),
    db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_SANDBOX_TEST_RECORDED", entityType: "ApplicationTemplate", entityId: template.id, metadata: `Sandbox submission test ${status}; reference and provider payload retained outside audit metadata` } }),
  ]);
  revalidatePath(`/admin/templates/${template.id}`);
}

export async function uploadTemplateAcceptanceAction(templateId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const signerName = z.string().trim().min(2).max(160).parse(formData.get("signerName"));
  const signerEmail = z.string().trim().email().max(320).parse(formData.get("signerEmail"));
  const signedAt = z.coerce.date().max(new Date()).parse(formData.get("signedAt"));
  const file = formData.get("acceptanceRecord");
  if (!(file instanceof File) || !file.size) throw new Error("Upload the signed agency acceptance record.");
  const validation = validateUpload(file, env.MAX_UPLOAD_MB);
  if (!validation.valid) throw new Error(validation.error);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(["application/pdf", "image/png", "image/jpeg"].includes(file.type)) || !validateFileSignature(bytes, file.type)) throw new Error("The acceptance record must be a valid PDF, PNG, or JPEG.");
  await inspectDocumentSafety(bytes, file.type);
  await scanForMalware(bytes);
  const safeName = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const stored = await putObject(`template-acceptance/${template.housingProgramId}/${template.id}/${safeName}`, bytes, file.type);
  await db.$transaction([
    db.applicationTemplate.update({ where: { id: template.id }, data: { acceptanceStatus: "RECEIVED", acceptanceStorageKey: stored.key, acceptanceFilename: file.name, acceptanceSignerName: signerName, acceptanceSignerEmail: signerEmail, acceptanceSignedAt: signedAt } }),
    db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_ACCEPTANCE_UPLOADED", entityType: "ApplicationTemplate", entityId: template.id, metadata: "Signed agency acceptance record uploaded; document contents and signer details remain restricted" } }),
  ]);
  revalidatePath(`/admin/templates/${template.id}`);
}

export async function approveTemplateAcceptanceAction(templateId: string) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  if (template.acceptanceStatus !== "RECEIVED" || !template.acceptanceStorageKey || !template.acceptanceSignerName || !template.acceptanceSignedAt) throw new Error("A signed agency acceptance record must be uploaded before it can be verified.");
  await db.$transaction([
    db.applicationTemplate.update({ where: { id: template.id }, data: { acceptanceStatus: "APPROVED" } }),
    db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_ACCEPTANCE_VERIFIED", entityType: "ApplicationTemplate", entityId: template.id, metadata: "Administrator verified the signed agency acceptance record" } }),
  ]);
  revalidatePath(`/admin/templates/${template.id}`);
}

export async function updateApplicationTemplateFieldAction(templateId: string, fieldId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  if (template.status !== "DRAFT") throw new Error("Published template versions are immutable. Create a new version to make changes.");
  const field = await db.applicationTemplateField.findFirstOrThrow({ where: { id: fieldId, templateId } });
  const validationRules = z.string().trim().max(2000).parse(String(formData.get("validationRules") ?? ""));
  if (validationRules) {
    try {
      const parsed = JSON.parse(validationRules) as { pattern?: unknown; minLength?: unknown };
      if (typeof parsed !== "object" || parsed === null || parsed.pattern !== undefined && typeof parsed.pattern !== "string" || parsed.minLength !== undefined && (!Number.isInteger(parsed.minLength) || Number(parsed.minLength) < 0)) throw new Error();
    } catch { throw new Error("Validation rules must be valid JSON, for example {\"minLength\":2} or {\"pattern\":\"^[A-Z]+$\"}."); }
  }
  const data = {
    displayLabel: z.string().trim().min(1).max(160).parse(formData.get("displayLabel")),
    fieldType: z.enum(["TEXT", "DATE", "CURRENCY", "BOOLEAN", "SELECT", "REPEATING_GROUP", "SIGNATURE"]).parse(formData.get("fieldType")),
    required: formData.get("required") === "on",
    canonicalFieldPath: z.string().trim().max(160).parse(String(formData.get("canonicalFieldPath") ?? "")) || null,
    section: z.string().trim().min(1).max(120).parse(formData.get("section")),
    staffGuidance: z.string().trim().max(500).parse(String(formData.get("staffGuidance") ?? "")) || null,
    validationRules: validationRules || null,
  };
  await db.$transaction([db.applicationTemplateField.update({ where: { id: field.id }, data }), db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_FIELD_UPDATED", entityType: "ApplicationTemplateField", entityId: field.id, metadata: "Template field mapping updated" } })]);
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function addApplicationTemplateFieldAction(templateId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { _count: { select: { fields: true } } } });
  if (template.status !== "DRAFT") throw new Error("Published template versions are immutable.");
  const fieldKey = z.string().trim().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/).parse(formData.get("fieldKey"));
  const created = await db.applicationTemplateField.create({ data: { templateId, fieldKey, displayLabel: z.string().trim().min(1).max(160).parse(formData.get("displayLabel")), fieldType: z.enum(["TEXT", "DATE", "CURRENCY", "BOOLEAN", "SELECT", "REPEATING_GROUP", "SIGNATURE"]).parse(formData.get("fieldType")), required: formData.get("required") === "on", canonicalFieldPath: z.string().trim().max(160).parse(String(formData.get("canonicalFieldPath") ?? "")) || null, pageNumber: 1, section: z.string().trim().min(1).max(120).parse(formData.get("section")), displayOrder: template._count.fields + 1, staffGuidance: z.string().trim().max(500).parse(String(formData.get("staffGuidance") ?? "")) || null } });
  await db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_FIELD_ADDED", entityType: "ApplicationTemplateField", entityId: created.id, metadata: "Generated template field added" } });
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function publishApplicationTemplateAction(templateId: string) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { fields: true } });
  if (template.status !== "DRAFT" || !template.fields.length) throw new Error("Only a draft template with fields can be published.");
  const previous = template.supersedesTemplateId ? await db.applicationTemplate.findUnique({ where: { id: template.supersedesTemplateId }, include: { fields: true } }) : null;
  const compatibility = previous ? compareTemplateVersions(previous.fields, template.fields) : { compatible: true, blockers: [] as string[] };
  if (!compatibility.compatible) throw new Error(`Template compatibility checks failed: ${compatibility.blockers.join(" ")}`);
  if (template.requiresAgencyAcceptance && (template.acceptanceStatus !== "APPROVED" || template.sandboxTestStatus !== "PASS")) throw new Error("Real-agency templates require a verified signed acceptance record and a passing sandbox submission test before publication.");
  await db.$transaction([db.applicationTemplate.update({ where: { id: templateId }, data: { status: "ACTIVE", publishedAt: new Date(), compatibilityKey: templateVersionFingerprint(template.fields) } }), db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_PUBLISHED", entityType: "ApplicationTemplate", entityId: templateId, metadata: `Version ${template.version} published and locked after compatibility checks` } })]);
  revalidatePath(`/admin/templates/${templateId}`); revalidatePath(`/admin/programs/${template.housingProgramId}`);
}

export async function cloneApplicationTemplateVersionAction(templateId: string) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const source = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { fields: true } });
  const version = (await db.applicationTemplate.aggregate({ where: { housingProgramId: source.housingProgramId, name: source.name }, _max: { version: true } }))._max.version ?? source.version;
  const clone = await db.$transaction(async (tx) => {
    const created = await tx.applicationTemplate.create({ data: { housingProgramId: source.housingProgramId, name: source.name, description: source.description, version: version + 1, status: "DRAFT", templateType: source.templateType, sourceStorageKey: source.sourceStorageKey, sourceFilePath: source.sourceFilePath, outputFilenamePattern: source.outputFilenamePattern, supersedesTemplateId: source.id, requiresAgencyAcceptance: source.requiresAgencyAcceptance, migrationNotes: `Cloned from version ${source.version} for controlled upgrade.` } });
    await tx.applicationTemplateField.createMany({ data: source.fields.map((field) => ({ templateId: created.id, fieldKey: field.fieldKey, displayLabel: field.displayLabel, fieldType: field.fieldType, required: field.required, canonicalFieldPath: field.canonicalFieldPath, pageNumber: field.pageNumber, section: field.section, displayOrder: field.displayOrder, validationRules: field.validationRules, conditionalRules: field.conditionalRules, formattingRules: field.formattingRules, pdfFieldName: field.pdfFieldName, positionInformation: field.positionInformation, staffGuidance: field.staffGuidance, optionsJson: field.optionsJson })) });
    await tx.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_VERSION_CREATED", entityType: "ApplicationTemplate", entityId: created.id, metadata: `Version ${created.version} cloned from version ${source.version}` } });
    return created;
  });
  redirect(`/admin/templates/${clone.id}`);
}

export async function deprecateApplicationTemplateAction(templateId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const reason = z.string().trim().min(10).max(1000).parse(formData.get("reason"));
  const template = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId } });
  if (template.status !== "ACTIVE") throw new Error("Only an active published template can be deprecated.");
  await db.$transaction([db.applicationTemplate.update({ where: { id: templateId }, data: { status: "DEPRECATED", deprecatedAt: new Date(), deprecatedReason: reason } }), db.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_DEPRECATED", entityType: "ApplicationTemplate", entityId: templateId, metadata: `Version ${template.version} deprecated; reason retained outside audit metadata` } })]);
  revalidatePath(`/admin/templates/${templateId}`);
  revalidatePath(`/admin/programs/${template.housingProgramId}`);
}

export async function rollbackApplicationTemplateAction(templateId: string) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const source = await db.applicationTemplate.findUniqueOrThrow({ where: { id: templateId }, include: { fields: true } });
  if (!source.publishedAt) throw new Error("Rollback requires a previously published template version.");
  const latest = await db.applicationTemplate.findFirst({ where: { housingProgramId: source.housingProgramId, name: source.name }, orderBy: { version: "desc" } });
  const created = await db.$transaction(async (tx) => {
    const clone = await tx.applicationTemplate.create({ data: { housingProgramId: source.housingProgramId, name: source.name, description: source.description, version: (latest?.version ?? source.version) + 1, status: "DRAFT", templateType: source.templateType, sourceStorageKey: source.sourceStorageKey, sourceFilePath: source.sourceFilePath, outputFilenamePattern: source.outputFilenamePattern, supersedesTemplateId: latest?.id ?? source.id, rollbackFromTemplateId: source.id, requiresAgencyAcceptance: source.requiresAgencyAcceptance, migrationNotes: `Rollback draft recreated from published version ${source.version}.` } });
    await tx.applicationTemplateField.createMany({ data: source.fields.map((field) => ({ templateId: clone.id, fieldKey: field.fieldKey, displayLabel: field.displayLabel, fieldType: field.fieldType, required: field.required, canonicalFieldPath: field.canonicalFieldPath, pageNumber: field.pageNumber, section: field.section, displayOrder: field.displayOrder, validationRules: field.validationRules, conditionalRules: field.conditionalRules, formattingRules: field.formattingRules, pdfFieldName: field.pdfFieldName, positionInformation: field.positionInformation, staffGuidance: field.staffGuidance, optionsJson: field.optionsJson })) });
    await tx.auditEvent.create({ data: { userId: user.id, action: "APPLICATION_TEMPLATE_ROLLBACK_DRAFTED", entityType: "ApplicationTemplate", entityId: clone.id, metadata: `Rollback draft created from immutable version ${source.version}` } });
    return clone;
  });
  redirect(`/admin/templates/${created.id}`);
}

export async function addSubmissionDestinationAction(programId: string, formData: FormData) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
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

const staffRoleSchema = z.enum(["CASEWORKER", "REVIEWER", "SUPERVISOR", "AUDITOR", "SUPPORT_READ_ONLY", "ADMIN"]);

export async function createStaffUserAction(formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"])); if (!(await emailConfiguredForOrganization())) throw new Error("SMTP must be configured before inviting staff users.");
  const email = z.string().email().parse(String(formData.get("email") ?? "").trim().toLowerCase()); const name = z.string().trim().min(2).max(120).parse(formData.get("name")); const role = staffRoleSchema.parse(formData.get("role")); const token = crypto.randomBytes(32).toString("base64url"); const temporaryPassword = crypto.randomBytes(32).toString("base64url");
  const user = await db.$transaction(async (tx) => { const created = await tx.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(temporaryPassword, 12) } }); await tx.passwordResetToken.create({ data: { userId: created.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }); await tx.auditEvent.create({ data: { userId: admin.id, action: "STAFF_USER_INVITED", entityType: "User", entityId: created.id, metadata: `Staff role ${role} invited; credentials not logged` } }); return created; });
  await sendEmail({ to: user.email, subject: "Set up your Housing Packet Builder account", text: `You were invited to the Housing Application Packet Builder. Set your password within 24 hours: ${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}` }); revalidatePath("/admin/users");
}

export async function updateStaffUserAction(userId: string, formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"])); if (userId === admin.id && formData.get("isActive") !== "on") throw new Error("You cannot deactivate your own account."); const role = staffRoleSchema.parse(formData.get("role")); const isActive = formData.get("isActive") === "on";
  await db.$transaction([db.user.update({ where: { id: userId }, data: { role, isActive } }), db.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }), db.auditEvent.create({ data: { userId: admin.id, action: "STAFF_ACCESS_UPDATED", entityType: "User", entityId: userId, metadata: `Role ${role}; active ${isActive}; existing sessions revoked` } })]); revalidatePath("/admin/users");
}

export async function updateRetentionPolicyAction(formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const retentionDays = z.coerce.number().int().min(30).max(36500).parse(formData.get("retentionDays"));
  const deletionGraceDays = z.coerce.number().int().min(1).max(365).parse(formData.get("deletionGraceDays"));
  await runWithOrganization(admin.organizationId, async () => {
    await db.organization.update({ where: { id: admin.organizationId }, data: { retentionDays, deletionGraceDays } });
    await db.auditEvent.create({ data: { userId: admin.id, action: "RETENTION_POLICY_UPDATED", entityType: "Organization", entityId: admin.organizationId, metadata: `Retention ${retentionDays} days; deletion grace ${deletionGraceDays} days` } });
  });
  revalidatePath("/admin/data-governance");
}

export async function updateSignaturePolicyAction(formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const input = z.object({
    consentText: z.string().trim().min(20).max(4000),
    consentVersion: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
    signatureDisclaimer: z.string().trim().min(20).max(4000),
    signaturePolicy: z.enum(["TYPED", "TYPED_OR_DRAWN"]),
  }).parse(Object.fromEntries(formData));
  await runWithOrganization(admin.organizationId, async () => {
    await db.organization.update({ where: { id: admin.organizationId }, data: input });
    await db.auditEvent.create({ data: { userId: admin.id, action: "SIGNATURE_POLICY_UPDATED", entityType: "Organization", entityId: admin.organizationId, metadata: `Signature and consent policy version ${input.consentVersion} activated; policy text not logged` } });
  });
  revalidatePath("/admin/data-governance");
}

export async function exportCaseDataAction(clientCaseId: string, formData?: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const reason = formData ? z.string().trim().min(10).max(1000).parse(formData.get("reason")) : "Authorized case export requested by an administrator.";
  const request = await exportCaseData(clientCaseId, admin.id, reason);
  redirect(`/api/data-exports/${request.id}`);
}

export async function requestCaseDeletionAction(clientCaseId: string, formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const reason = z.string().trim().min(10).max(1000).parse(formData.get("reason"));
  await requestCaseDeletion(clientCaseId, admin.id, reason);
  revalidatePath("/admin/data-governance");
}

export async function approveCaseDeletionAction(requestId: string) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  await approveCaseDeletion(requestId, admin.id);
  revalidatePath("/admin/data-governance");
}

export async function cancelCaseDeletionAction(requestId: string) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  await cancelCaseDeletion(requestId, admin.id);
  revalidatePath("/admin/data-governance");
}

export async function updateLegalHoldAction(clientCaseId: string, formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const enabled = formData.get("enabled") === "on";
  const reason = enabled ? z.string().trim().min(10).max(1000).parse(formData.get("reason")) : null;
  await setLegalHold(clientCaseId, admin.id, reason);
  revalidatePath("/admin/data-governance");
}
