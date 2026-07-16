import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createTenantDatabase } from "@/lib/tenant-database";
import { runWithOrganization } from "@/lib/tenant-context";

const adminUrl = process.env.POSTGRES_TEST_ADMIN_URL;
const appUrl = process.env.POSTGRES_TEST_APP_URL;

describe.skipIf(!adminUrl || !appUrl)("PostgreSQL row-level security", () => {
  it("fails closed and isolates application-role operations", async () => {
    const suffix = randomUUID().slice(0, 8);
    const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    const application = new PrismaClient({ datasources: { db: { url: appUrl } } });
    const tenant = createTenantDatabase(application, { databaseRls: true });
    const organizationA = await admin.organization.create({ data: { slug: `rls-a-${suffix}`, name: "Synthetic RLS A" } });
    const organizationB = await admin.organization.create({ data: { slug: `rls-b-${suffix}`, name: "Synthetic RLS B" } });
    try {
      const [userA, userB] = await Promise.all([
        admin.user.create({ data: { organizationId: organizationA.id, name: "Synthetic RLS User A", email: `rls-a-${suffix}@example.test`, passwordHash: "synthetic-password-hash", role: "CASEWORKER" } }),
        admin.user.create({ data: { organizationId: organizationB.id, name: "Synthetic RLS User B", email: `rls-b-${suffix}@example.test`, passwordHash: "synthetic-password-hash", role: "CASEWORKER" } }),
      ]);
      const caseA = await runWithOrganization(organizationA.id, () => tenant.clientCase.create({ data: { referenceNumber: `RLS-A-${suffix}`, legalName: "Synthetic RLS Applicant", assignedCaseworkerId: userA.id } }));

      expect(await application.clientCase.findMany()).toEqual([]);
      await runWithOrganization(organizationB.id, async () => {
        expect(await tenant.clientCase.findUnique({ where: { id: caseA.id } })).toBeNull();
        await expect(tenant.clientCase.create({ data: { referenceNumber: `RLS-B-${suffix}`, legalName: "Synthetic Cross Organization", assignedCaseworkerId: userA.id } })).rejects.toThrow();
        expect(await tenant.user.findMany()).toEqual([expect.objectContaining({ id: userB.id })]);
      });
    } finally {
      await admin.clientCase.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await admin.user.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await admin.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
      await Promise.all([admin.$disconnect(), application.$disconnect()]);
    }
  }, 30_000);
});
