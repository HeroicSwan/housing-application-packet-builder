import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("production PostgreSQL artifacts", () => {
  it("keeps the generated PostgreSQL model inventory aligned with local development", () => {
    const local = fs.readFileSync("prisma/schema.prisma", "utf8");
    const production = fs.readFileSync("prisma/production/schema.prisma", "utf8");
    const models = (schema: string) => [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(([, model]) => model).sort();
    expect(production).toContain('provider = "postgresql"');
    expect(production).not.toMatch(/organizationId\s+String\?/);
    expect(models(production)).toEqual(models(local));
  });

  it("forces row-level security for every tenant-owned table", () => {
    const migration = fs.readdirSync("prisma/production/migrations", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => fs.readFileSync(`prisma/production/migrations/${entry.name}/migration.sql`, "utf8"))
      .join("\n");
    const schema = fs.readFileSync("prisma/production/schema.prisma", "utf8");
    const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(([, model]) => model).filter((model) => !["RateLimitBucket", "BackupRun"].includes(model));
    for (const model of models) {
      expect(migration).toContain(`ALTER TABLE "${model}" ENABLE ROW LEVEL SECURITY;`);
      expect(migration).toContain(`ALTER TABLE "${model}" FORCE ROW LEVEL SECURITY;`);
      expect(migration).toContain(`CREATE POLICY tenant_isolation ON "${model}"`);
    }
  });

  it("seals audit events and rejects mutation at the database boundary", () => {
    const migration = fs.readFileSync("prisma/production/migrations/20260715014500_data_lifecycle_jobs/migration.sql", "utf8");
    expect(migration).toContain("CREATE TRIGGER audit_event_seal");
    expect(migration).toContain("CREATE TRIGGER audit_event_append_only");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
