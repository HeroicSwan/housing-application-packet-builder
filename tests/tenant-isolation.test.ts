import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createTenantDatabase } from "@/lib/tenant-database";
import { runWithOrganization } from "@/lib/tenant-context";
import { tenantScopeByModel } from "@/lib/tenant-scope";
import { verifyAuditChain } from "@/lib/audit/chain";

const repositoryRoot = process.cwd();

describe("organization isolation", () => {
  it("accounts for every tenant-owned Prisma model", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
    const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(([, model]) => model).filter((model) => !["RateLimitBucket", "BackupRun"].includes(model)).sort();
    expect(Object.keys(tenantScopeByModel).sort()).toEqual(models);
  });

  it("rejects cross-organization reads, writes, and parent references", async () => {
    const filename = `synthetic-tenant-${randomUUID()}.db`;
    const databaseUrl = `file:./${filename}`;
    const databasePath = path.join(repositoryRoot, "prisma", filename);
    const prismaCli = path.resolve(repositoryRoot, "node_modules", "prisma", "build", "index.js");
    fs.closeSync(fs.openSync(databasePath, "w"));
    const push = spawnSync(process.execPath, [prismaCli, "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databaseUrl, DATA_MODE: "synthetic" },
    });
    if (push.status !== 0) throw new Error(push.stderr || push.stdout);

    const raw = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const tenant = createTenantDatabase(raw);
    try {
      const [organizationA, organizationB] = await Promise.all([
        raw.organization.create({ data: { slug: "tenant-a", name: "Synthetic Tenant A" } }),
        raw.organization.create({ data: { slug: "tenant-b", name: "Synthetic Tenant B" } }),
      ]);
      const [userA, userB] = await Promise.all([
        raw.user.create({ data: { organizationId: organizationA.id, name: "Synthetic A", email: "a@example.test", passwordHash: "synthetic-password-hash", role: "CASEWORKER" } }),
        raw.user.create({ data: { organizationId: organizationB.id, name: "Synthetic B", email: "b@example.test", passwordHash: "synthetic-password-hash", role: "CASEWORKER" } }),
      ]);

      const caseA = await runWithOrganization(organizationA.id, () => tenant.clientCase.create({ data: {
        referenceNumber: "TENANT-A-001",
        legalName: "Synthetic Applicant A",
        assignedCaseworkerId: userA.id,
      } }));
      expect(caseA.organizationId).toBe(organizationA.id);

      await runWithOrganization(organizationA.id, async () => {
        await tenant.auditEvent.create({ data: { userId: userA.id, clientCaseId: caseA.id, action: "CASE_CREATED", entityType: "ClientCase", entityId: caseA.id } });
        await tenant.auditEvent.create({ data: { userId: userA.id, clientCaseId: caseA.id, action: "CASE_UPDATED", entityType: "ClientCase", entityId: caseA.id } });
        const events = await tenant.auditEvent.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        expect(verifyAuditChain(events, organizationA.id)).toBe(true);
        await expect(tenant.auditEvent.update({ where: { id: events[0].id }, data: { action: "TAMPERED" } })).rejects.toThrow("append-only");
        await expect(tenant.auditEvent.delete({ where: { id: events[0].id } })).rejects.toThrow("append-only");
      });

      await runWithOrganization(organizationB.id, async () => {
        expect(await tenant.clientCase.findUnique({ where: { id: caseA.id } })).toBeNull();
        await expect(tenant.clientCase.update({ where: { id: caseA.id }, data: { status: "APPROVED" } })).rejects.toThrow();
        await expect(tenant.householdMember.create({ data: { clientCaseId: caseA.id, name: "Synthetic Cross Tenant", relationship: "Other" } })).rejects.toThrow("Cross-organization parent reference rejected.");
        await expect(tenant.clientCase.create({ data: { referenceNumber: "TENANT-B-X", legalName: "Synthetic Applicant B", assignedCaseworkerId: userA.id } })).rejects.toThrow("Cross-organization parent reference rejected.");
        await expect(tenant.user.create({ data: { organizationId: organizationA.id, name: "Synthetic Wrong Tenant", email: "wrong@example.test", passwordHash: "synthetic-password-hash", role: "ADMIN" } })).rejects.toThrow("Cross-organization write rejected.");
      });

      await expect(tenant.user.findMany()).rejects.toThrow("Organization context is required");
      expect(userB.organizationId).toBe(organizationB.id);
    } finally {
      await raw.$disconnect();
      for (const suffix of ["", "-journal", "-shm", "-wal"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }, 30_000);
});
