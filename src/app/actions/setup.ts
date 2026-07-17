"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bootstrapInstallation } from "@/lib/setup/bootstrap";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { activateOrganizationContext, createSession, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assessSetupReadiness, saveSetupSections, type SectionSave } from "@/lib/setup/state";
import { setupStepSchema, type SetupStepId, safeSetupConfiguration } from "@/lib/setup/steps";
import { accessSetupSchema, aiSetupSchema, booleanField, deliverySetupSchema, governanceSetupSchema, malwareSetupSchema, numberField, operationsSetupSchema, organizationSetupSchema, smtpSetupSchema, storageSetupSchema, stringField } from "@/lib/setup/schemas";
import { runSetupConnectionTest, setupConnectionTestSchema } from "@/lib/setup/connection-tests";

const revisionSchema = z.coerce.number().int().nonnegative();

function setupError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Review the highlighted settings.";
  if (error instanceof Error && /Another administrator|Setup is complete/.test(error.message)) return error.message;
  return "The settings were not saved. Review the required fields and try again.";
}

export async function bootstrapSetupAction(formData: FormData) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!(await checkRateLimit(`setup-bootstrap:${address}`, 5, 15 * 60_000))) redirect("/setup?error=The+installation+claim+is+temporarily+rate-limited.");
  if (stringField(formData, "password") !== stringField(formData, "confirmPassword")) redirect("/setup?error=Passwords+do+not+match.");
  let result: Awaited<ReturnType<typeof bootstrapInstallation>>;
  try {
    result = await bootstrapInstallation({ token: stringField(formData, "token"), organizationName: stringField(formData, "organizationName"), administratorName: stringField(formData, "administratorName"), administratorEmail: stringField(formData, "administratorEmail"), password: stringField(formData, "password") });
  } catch {
    redirect("/setup?error=The+installation+claim+was+not+accepted.+Check+the+one-time+token+or+installation+state.");
  }
  await createSession(result.userId);
  redirect("/admin/setup?step=organization&bootstrapped=1");
}

function parseStepSections(step: SetupStepId, formData: FormData): SectionSave[] {
  if (step === "organization") return [{ section: "organization", configuration: organizationSetupSchema.parse({ name: stringField(formData, "name"), jurisdiction: stringField(formData, "jurisdiction"), contactName: stringField(formData, "contactName"), contactEmail: stringField(formData, "contactEmail"), contactPhone: stringField(formData, "contactPhone") }) }];
  if (step === "access") return [{ section: "access", configuration: accessSetupSchema.parse({ requireMfa: booleanField(formData, "requireMfa"), sessionDurationMinutes: numberField(formData, "sessionDurationMinutes"), sessionIdleMinutes: numberField(formData, "sessionIdleMinutes"), passwordMinLength: numberField(formData, "passwordMinLength"), passwordRequireUppercase: booleanField(formData, "passwordRequireUppercase"), passwordRequireNumber: booleanField(formData, "passwordRequireNumber") }) }];
  if (step === "governance") return [{ section: "governance", configuration: governanceSetupSchema.parse({ retentionDays: numberField(formData, "retentionDays"), documentRetentionDays: numberField(formData, "documentRetentionDays"), auditRetentionDays: numberField(formData, "auditRetentionDays"), deletionGraceDays: numberField(formData, "deletionGraceDays"), legalHoldPolicy: stringField(formData, "legalHoldPolicy"), consentText: stringField(formData, "consentText") || "I consent to the approved supporting documents being shared for this application.", consentVersion: stringField(formData, "consentVersion") || "document-release-v1", signatureDisclaimer: stringField(formData, "signatureDisclaimer") || "Electronic signature acceptance depends on organization policy and applicable law.", signaturePolicy: stringField(formData, "signaturePolicy") || "TYPED" }) }];
  if (step === "services") {
    const smtp = smtpSetupSchema.parse({ host: stringField(formData, "smtpHost"), port: numberField(formData, "smtpPort"), secure: booleanField(formData, "smtpSecure"), user: stringField(formData, "smtpUser"), from: stringField(formData, "emailFrom") });
    const storage = storageSetupSchema.parse({ provider: stringField(formData, "storageProvider"), localRoot: stringField(formData, "localRoot"), bucket: stringField(formData, "bucket"), region: stringField(formData, "region"), endpoint: stringField(formData, "storageEndpoint"), accessKeyId: stringField(formData, "accessKeyId"), privateBucketAcknowledged: booleanField(formData, "privateBucketAcknowledged") });
    const malware = malwareSetupSchema.parse({ scanner: stringField(formData, "malwareScanner"), host: stringField(formData, "clamAvHost"), port: numberField(formData, "clamAvPort") });
    return [
      { section: "smtp", configuration: smtp, secretReplacement: stringField(formData, "smtpPassword") ? { password: stringField(formData, "smtpPassword") } : undefined },
      { section: "storage", configuration: storage, secretReplacement: stringField(formData, "secretAccessKey") ? { secretAccessKey: stringField(formData, "secretAccessKey") } : undefined },
      { section: "malware", configuration: malware },
    ];
  }
  if (step === "ai") {
    const ai = aiSetupSchema.parse({ provider: stringField(formData, "provider"), model: stringField(formData, "model"), baseUrl: stringField(formData, "baseUrl"), providerRetentionAcknowledged: booleanField(formData, "providerRetentionAcknowledged"), dataProcessingAgreementAcknowledged: booleanField(formData, "dataProcessingAgreementAcknowledged") });
    return [{ section: "ai", configuration: ai, secretReplacement: stringField(formData, "apiKey") ? { apiKey: stringField(formData, "apiKey") } : undefined }];
  }
  if (step === "operations") {
    const operations = operationsSetupSchema.parse({ monitoringEndpoint: stringField(formData, "monitoringEndpoint"), alertContact: stringField(formData, "alertContact"), backupSchedule: stringField(formData, "backupSchedule"), backupDestination: stringField(formData, "backupDestination"), backupRetentionDays: numberField(formData, "backupRetentionDays"), workerHealthUrl: stringField(formData, "workerHealthUrl") });
    const secrets = { ...(stringField(formData, "monitoringToken") ? { monitoringToken: stringField(formData, "monitoringToken") } : {}), ...(stringField(formData, "backupCredential") ? { backupCredential: stringField(formData, "backupCredential") } : {}) };
    return [{ section: "operations", configuration: operations, secretReplacement: Object.keys(secrets).length ? secrets : undefined }, { section: "database", configuration: { source: "deployment" } }, { section: "monitoring", configuration: { endpoint: operations.monitoringEndpoint } }, { section: "backup", configuration: { schedule: operations.backupSchedule, destination: operations.backupDestination, retentionDays: operations.backupRetentionDays } }];
  }
  if (step === "delivery") {
    const delivery = deliverySetupSchema.parse({ type: stringField(formData, "type"), name: stringField(formData, "destinationName"), recipient: stringField(formData, "recipient"), endpoint: stringField(formData, "endpoint"), adapter: stringField(formData, "adapter"), remoteTestAcknowledged: booleanField(formData, "remoteTestAcknowledged") });
    return [{ section: "delivery", configuration: delivery, secretReplacement: stringField(formData, "authToken") ? { authToken: stringField(formData, "authToken") } : undefined }];
  }
  throw new Error("Use the final review action to complete setup.");
}

export async function saveSetupStepAction(formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const step = setupStepSchema.parse(formData.get("step"));
  try {
    await saveSetupSections({ organizationId: admin.organizationId, userId: admin.id, step, revision: revisionSchema.parse(formData.get("revision")), sections: parseStepSections(step, formData), continue: formData.get("intent") === "continue" });
  } catch (error) {
    redirect(`/admin/setup?step=${step}&error=${encodeURIComponent(setupError(error))}`);
  }
  const organization = await db.organization.findUniqueOrThrow({ where: { id: admin.organizationId } });
  redirect(`/admin/setup?step=${formData.get("intent") === "continue" ? organization.setupCurrentStep : step}&saved=1`);
}

export async function testSetupConnectionAction(formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const kind = setupConnectionTestSchema.parse(formData.get("kind"));
  if (!(await checkRateLimit(`setup-test:${admin.organizationId}:${kind}`, 8, 60_000))) redirect(`/admin/setup?step=${stringField(formData, "step")}&error=Connection+tests+are+temporarily+rate-limited.`);
  await runSetupConnectionTest({ organizationId: admin.organizationId, userId: admin.id, kind });
  revalidatePath("/admin/setup");
  redirect(`/admin/setup?step=${stringField(formData, "step")}&tested=${kind}`);
}

export async function reopenSetupAction() {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const organization = await db.organization.findUniqueOrThrow({ where: { id: admin.organizationId } });
  if (organization.setupStatus !== "COMPLETED") redirect(`/admin/setup?step=${organization.setupCurrentStep}`);
  const sections = await db.organizationSetupSection.findMany();
  for (const section of sections) if (section.activeConfigurationJson) await db.organizationSetupSection.update({ where: { id: section.id }, data: { configurationJson: section.activeConfigurationJson, secretEncrypted: section.activeSecretEncrypted, configurationFingerprint: section.configurationFingerprint } });
  await db.$transaction([
    db.organization.update({ where: { id: admin.organizationId }, data: { setupStatus: "IN_PROGRESS", setupCurrentStep: "organization", setupReopenedAt: new Date(), setupRevision: { increment: 1 } } }),
    db.auditEvent.create({ data: { userId: admin.id, action: "SETUP_REOPENED", entityType: "Organization", entityId: admin.organizationId, metadata: "Administrator explicitly reopened a new configuration draft" } }),
  ]);
  redirect("/admin/setup?step=organization&reopened=1");
}

export async function completeSetupAction(formData: FormData) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  if (!["accuracyAcknowledged", "legalAcknowledged", "realDataAcknowledged"].every((name) => booleanField(formData, name))) redirect("/admin/setup?step=review&error=All+three+organization+acknowledgements+are+required.");
  const currentOrganization = await db.organization.findUniqueOrThrow({ where: { id: admin.organizationId }, select: { setupRevision: true, setupStatus: true } });
  if (currentOrganization.setupStatus === "COMPLETED") redirect("/admin/setup?step=review&error=Setup+is+already+complete.");
  const readiness = await assessSetupReadiness(admin.organizationId);
  if (!readiness.ready) redirect("/admin/setup?step=review&error=Resolve+every+blocking+readiness+item+before+sign-off.");
  const sections = await db.organizationSetupSection.findMany();
  const configuration = new Map(sections.map((section) => [section.section, safeSetupConfiguration(section.configurationJson)]));
  const organization = organizationSetupSchema.parse(configuration.get("organization"));
  const access = accessSetupSchema.parse(configuration.get("access"));
  const governance = governanceSetupSchema.parse(configuration.get("governance"));
  const completedAt = new Date();
  await db.$transaction(async (tx) => {
    const reserved = await tx.organization.updateMany({ where: { id: admin.organizationId, setupStatus: "IN_PROGRESS", setupRevision: currentOrganization.setupRevision }, data: { ...organization, ...access, ...governance, setupStatus: "COMPLETED", setupCurrentStep: "review", setupCompletedAt: completedAt, setupCompletedById: admin.id, setupLegalAcknowledgedAt: completedAt, setupRevision: { increment: 1 } } });
    if (reserved.count !== 1) throw new Error("Another administrator changed setup. Reload before signing off.");
    for (const section of sections) await tx.organizationSetupSection.update({ where: { id: section.id }, data: { activeConfigurationJson: section.configurationJson, activeSecretEncrypted: section.secretEncrypted, activatedAt: completedAt } });
    await tx.organizationSetupSection.upsert({ where: { organizationId_section: { organizationId: admin.organizationId, section: "review" } }, create: { organizationId: admin.organizationId, section: "review", configurationJson: JSON.stringify({ acknowledgementVersion: "2026-07-15", accuracyAcknowledged: true, legalAcknowledged: true, realDataAcknowledged: true }), activeConfigurationJson: JSON.stringify({ acknowledgementVersion: "2026-07-15", accuracyAcknowledged: true, legalAcknowledged: true, realDataAcknowledged: true }), completedAt, activatedAt: completedAt, updatedById: admin.id }, update: { configurationJson: JSON.stringify({ acknowledgementVersion: "2026-07-15", accuracyAcknowledged: true, legalAcknowledged: true, realDataAcknowledged: true }), activeConfigurationJson: JSON.stringify({ acknowledgementVersion: "2026-07-15", accuracyAcknowledged: true, legalAcknowledged: true, realDataAcknowledged: true }), completedAt, activatedAt: completedAt, updatedById: admin.id } });
    await tx.auditEvent.create({ data: { userId: admin.id, action: "SETUP_COMPLETED", entityType: "Organization", entityId: admin.organizationId, metadata: "Administrator completed setup acknowledgement; configuration values and credentials not logged" } });
  });
  redirect("/admin/setup?step=review&completed=1");
}
