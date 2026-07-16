import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { encryptText, sha256 } from "@/lib/security/encryption";
import { nextSetupStep, safeSetupConfiguration, type SetupStepId } from "./steps";

export type SectionSave = { section: string; configuration: Record<string, unknown>; secretReplacement?: Record<string, string>; complete?: boolean };

export async function saveSetupSections(input: { organizationId: string; userId: string; step: SetupStepId; revision: number; sections: SectionSave[]; continue: boolean }) {
  const organization = await db.organization.findUniqueOrThrow({ where: { id: input.organizationId } });
  if (organization.setupStatus === "COMPLETED") throw new Error("Setup is complete. Reopen it explicitly before making changes.");
  const reserved = await db.organization.updateMany({ where: { id: input.organizationId, setupRevision: input.revision }, data: { setupRevision: { increment: 1 }, setupCurrentStep: input.continue ? nextSetupStep(input.step) : input.step } });
  if (reserved.count !== 1) throw new Error("Another administrator changed setup. Reload before saving again.");

  for (const section of input.sections) {
    const existing = await db.organizationSetupSection.findUnique({ where: { organizationId_section: { organizationId: input.organizationId, section: section.section } } });
    const configurationJson = JSON.stringify(section.configuration);
    const configurationFingerprint = sha256(configurationJson);
    const secretEncrypted = section.secretReplacement && Object.values(section.secretReplacement).some(Boolean)
      ? encryptText(JSON.stringify(section.secretReplacement))
      : existing?.secretEncrypted;
    const changed = existing?.configurationFingerprint !== configurationFingerprint || Boolean(section.secretReplacement && Object.values(section.secretReplacement).some(Boolean));
    await db.organizationSetupSection.upsert({
      where: { organizationId_section: { organizationId: input.organizationId, section: section.section } },
      create: { organizationId: input.organizationId, section: section.section, configurationJson, secretEncrypted, configurationFingerprint, completedAt: section.complete === false ? null : new Date(), updatedById: input.userId },
      update: { configurationJson, secretEncrypted, configurationFingerprint, completedAt: section.complete === false ? null : new Date(), updatedById: input.userId, ...(changed ? { lastTestedAt: null, lastTestStatus: null, lastTestCode: null, lastTestDurationMs: null, lastTestSummary: null } : {}) },
    });
    await db.auditEvent.create({ data: { userId: input.userId, action: "SETUP_SECTION_SAVED", entityType: "OrganizationSetupSection", entityId: section.section, metadata: `${section.section} configuration saved; values and credentials not logged` } });
  }
}

export type SetupReadiness = { ready: boolean; blockers: string[]; warnings: string[] };

export async function assessSetupReadiness(organizationId: string): Promise<SetupReadiness> {
  const [sections, users] = await Promise.all([
    db.organizationSetupSection.findMany({ where: { organizationId } }),
    db.user.findMany({ where: { isActive: true }, select: { role: true, mfaEnabled: true } }),
  ]);
  const byName = new Map(sections.map((section) => [section.section, section]));
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const name of ["organization", "access", "governance", "smtp", "storage", "malware", "ai", "operations", "delivery"]) if (!byName.get(name)?.completedAt) blockers.push(`${name} configuration is incomplete.`);
  const access = safeSetupConfiguration(byName.get("access")?.configurationJson ?? "{}");
  if (env.DATA_MODE === "production" && users.some((user) => user.role === "ADMIN" && !user.mfaEnabled)) blockers.push("Every active administrator must enroll in MFA before production sign-off.");
  if (access.requireMfa === true && users.some((user) => !user.mfaEnabled)) blockers.push("The selected MFA policy requires every active staff member to enroll before sign-off.");
  const ai = safeSetupConfiguration(byName.get("ai")?.configurationJson ?? "{}");
  const delivery = safeSetupConfiguration(byName.get("delivery")?.configurationJson ?? "{}");
  const requiredTests = ["smtp", "storage", "malware", "database", "monitoring", "backup"];
  if (ai.provider !== "disabled") requiredTests.push("ai", "ai-model");
  if (["API", "PORTAL_API"].includes(String(delivery.type))) requiredTests.push("delivery");
  for (const name of requiredTests) {
    const result = byName.get(name);
    if (result?.lastTestStatus === "PASSED") continue;
    if (env.DATA_MODE !== "production" && result?.lastTestStatus === "SIMULATED") { warnings.push(`${name} was simulated and must be run live before real-data use.`); continue; }
    blockers.push(`${name} connection test has not passed.`);
  }
  if (env.DATA_MODE === "production" && !env.DATA_ENCRYPTION_KEY) blockers.push("The deployment encryption key is not configured.");
  return { ready: blockers.length === 0, blockers, warnings };
}
