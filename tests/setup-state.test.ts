import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db, systemDb } from "@/lib/db";
import { decryptText } from "@/lib/security/encryption";
import { runWithOrganization } from "@/lib/tenant-context";
import { saveSetupSections } from "@/lib/setup/state";
import { accessSetupSchema, aiSetupSchema, governanceSetupSchema, organizationSetupSchema } from "@/lib/setup/schemas";

const createdOrganizations: string[] = [];

afterEach(async () => {
  for (const organizationId of createdOrganizations.splice(0)) {
    await systemDb.auditEvent.deleteMany({ where: { organizationId } });
    await systemDb.organizationSetupSection.deleteMany({ where: { organizationId } });
    await systemDb.authSession.deleteMany({ where: { organizationId } });
    await systemDb.user.deleteMany({ where: { organizationId } });
    await systemDb.organization.deleteMany({ where: { id: organizationId } });
  }
});

async function fixture() {
  const suffix = randomUUID();
  const organization = await systemDb.organization.create({ data: { slug: `setup-${suffix}`, name: "Synthetic Setup Organization" } });
  createdOrganizations.push(organization.id);
  const user = await systemDb.user.create({ data: { organizationId: organization.id, name: "Synthetic Setup Admin", email: `setup-${suffix}@example.test`, passwordHash: "synthetic-password-hash", role: "ADMIN" } });
  return { organization, user };
}

describe("administrator setup state", () => {
  it("encrypts replacement secrets, never reads them back through configuration, and preserves them on blank updates", async () => {
    const { organization, user } = await fixture();
    const canary = `synthetic-secret-${randomUUID()}`;
    await runWithOrganization(organization.id, () => saveSetupSections({ organizationId: organization.id, userId: user.id, step: "ai", revision: 0, continue: false, sections: [{ section: "ai", configuration: { provider: "groq", model: "synthetic-model" }, secretReplacement: { apiKey: canary } }] }));
    let record = await systemDb.organizationSetupSection.findFirstOrThrow({ where: { organizationId: organization.id, section: "ai" } });
    expect(record.configurationJson).not.toContain(canary);
    expect(record.secretEncrypted).not.toContain(canary);
    expect(JSON.parse(decryptText(record.secretEncrypted!))).toEqual({ apiKey: canary });
    await runWithOrganization(organization.id, () => saveSetupSections({ organizationId: organization.id, userId: user.id, step: "ai", revision: 1, continue: false, sections: [{ section: "ai", configuration: { provider: "groq", model: "synthetic-model-2" } }] }));
    record = await systemDb.organizationSetupSection.findFirstOrThrow({ where: { organizationId: organization.id, section: "ai" } });
    expect(JSON.parse(decryptText(record.secretEncrypted!))).toEqual({ apiKey: canary });
    expect(record.lastTestStatus).toBeNull();
  });

  it("rejects a stale concurrent revision and isolates setup rows by organization", async () => {
    const { organization, user } = await fixture();
    const attempts = await Promise.allSettled([
      runWithOrganization(organization.id, () => saveSetupSections({ organizationId: organization.id, userId: user.id, step: "organization", revision: 0, continue: false, sections: [{ section: "organization", configuration: { name: "Synthetic A" } }] })),
      runWithOrganization(organization.id, () => saveSetupSections({ organizationId: organization.id, userId: user.id, step: "organization", revision: 0, continue: false, sections: [{ section: "organization", configuration: { name: "Synthetic B" } }] })),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
    const other = await fixture();
    await runWithOrganization(other.organization.id, async () => expect(await db.organizationSetupSection.findMany()).toEqual([]));
  });

  it("validates every policy group before it can be marked complete", () => {
    expect(organizationSetupSchema.safeParse({ name: "", jurisdiction: "", contactName: "", contactEmail: "bad", contactPhone: "" }).success).toBe(false);
    expect(accessSetupSchema.safeParse({ requireMfa: true, sessionDurationMinutes: 30, sessionIdleMinutes: 60, passwordMinLength: 8, passwordRequireUppercase: true, passwordRequireNumber: true }).success).toBe(false);
    expect(governanceSetupSchema.safeParse({ retentionDays: 1, documentRetentionDays: 1, auditRetentionDays: 1, deletionGraceDays: 0, legalHoldPolicy: "short" }).success).toBe(false);
    expect(aiSetupSchema.safeParse({ provider: "groq", model: "", approvalId: "", providerRetentionAcknowledged: false, dataProcessingAgreementAcknowledged: false }).success).toBe(false);
  });
});
