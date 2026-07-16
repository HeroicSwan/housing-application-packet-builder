import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

function runSeed(overrides: Record<string, string | undefined>) {
  return spawnSync(process.execPath, ["prisma/seed.mjs"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "file:./dev.db",
      DATA_MODE: "synthetic",
      SYNTHETIC_SEED_CONTEXT: "direct",
      ...overrides,
    },
  });
}

describe("synthetic seed boundary", () => {
  it("rejects direct destructive seeding", () => {
    const result = runSeed({});
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Destructive synthetic seeding must run through db:setup, db:reset, or test:e2e.");
  });

  it("rejects a non-synthetic data mode before opening the database", () => {
    const result = runSeed({ DATA_MODE: "real", SYNTHETIC_SEED_CONTEXT: "local-reset" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Synthetic seeding never runs outside the synthetic profile.");
  });

  it("rejects a non-synthetic backup before opening the database", () => {
    const result = spawnSync(process.execPath, ["scripts/backup-database.mjs"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "file:./dev.db", DATA_MODE: "real" },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("DATA_MODE must be synthetic or production.");
  });

  it("preserves a database containing only operational records", async () => {
    const filename = `synthetic-preserve-${randomUUID()}.db`;
    const databaseUrl = `file:./${filename}`;
    const databasePath = path.join(repositoryRoot, "prisma", filename);
    const environment = { ...process.env, DATABASE_URL: databaseUrl, DATA_MODE: "synthetic" };
    const prismaCli = path.resolve(repositoryRoot, "node_modules", "prisma", "build", "index.js");
    let db: PrismaClient | undefined;

    try {
      fs.closeSync(fs.openSync(databasePath, "w"));
      const push = spawnSync(process.execPath, [prismaCli, "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: environment,
      });
      if (push.status !== 0) throw new Error(push.stderr || push.stdout);

      db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      await db.backupRun.create({ data: { status: "COMPLETED", provider: "local" } });
      await db.rateLimitBucket.create({ data: { key: "synthetic-preservation-test", count: 1, resetAt: new Date(Date.now() + 60_000) } });
      await db.$disconnect();
      db = undefined;

      const setup = spawnSync(process.execPath, ["scripts/seed-local-if-empty.mjs"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: environment,
      });
      expect(setup.status).toBe(0);
      expect(setup.stdout).toContain("Existing local data was preserved.");

      db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      expect(await db.backupRun.count()).toBe(1);
      expect(await db.rateLimitBucket.count()).toBe(1);
    } finally {
      await db?.$disconnect();
      for (const suffix of ["", "-journal", "-shm", "-wal"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
    }
  }, 30_000);
});
