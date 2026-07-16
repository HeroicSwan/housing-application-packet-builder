import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLocalDatabaseUrl } from "../scripts/local-database.mjs";

const repositoryRoot = path.resolve("synthetic-local-repository");

describe("local database selection", () => {
  it("accepts a direct local SQLite database", () => {
    const target = resolveLocalDatabaseUrl(repositoryRoot, "file:./dev.db");
    expect(target.databasePath).toBe(path.resolve(repositoryRoot, "prisma", "dev.db"));
  });

  it("accepts an explicitly named synthetic SQLite database", () => {
    const target = resolveLocalDatabaseUrl(repositoryRoot, "file:./synthetic-verification.db");
    expect(target.databasePath).toBe(path.resolve(repositoryRoot, "prisma", "synthetic-verification.db"));
  });

  it.each([
    "file:./production.db",
    "file:./live-data.db",
    "file:./e2e.db",
    "file:./agency.db",
    "file:./client.db",
    "file:../outside.db",
    "file:/absolute.db",
    "file:./nested/dev.db",
    "postgresql://localhost/app",
  ])("rejects an unsafe local database URL: %s", (databaseUrl) => {
    expect(() => resolveLocalDatabaseUrl(repositoryRoot, databaseUrl)).toThrow(
      "Local database commands require dev.db or a synthetic-*.db file directly under prisma/.",
    );
  });

  it("rejects non-synthetic setup before creating a database file", () => {
    const filename = `synthetic-rejected-${process.pid}.db`;
    const databasePath = path.resolve(process.cwd(), "prisma", filename);
    fs.rmSync(databasePath, { force: true });
    const result = spawnSync(process.execPath, ["scripts/ensure-local-db.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DATA_MODE: "real", DATABASE_URL: `file:./${filename}` },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Real applicant-data mode is not implemented or approved.");
    expect(fs.existsSync(databasePath)).toBe(false);
  });

  it("requires explicit confirmation before a synthetic reset", () => {
    const filename = `synthetic-reset-confirmation-${process.pid}.db`;
    const databasePath = path.resolve(process.cwd(), "prisma", filename);
    fs.writeFileSync(databasePath, "preserve-me");
    try {
      const result = spawnSync(process.execPath, ["scripts/reset-local-database.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, DATA_MODE: "synthetic", DATABASE_URL: `file:./${filename}` },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("DESTRUCTIVE SYNTHETIC RESET NOT RUN");
      expect(fs.readFileSync(databasePath, "utf8")).toBe("preserve-me");
    } finally {
      fs.rmSync(databasePath, { force: true });
    }
  });

  it("rejects production mode even with explicit reset confirmation", () => {
    const filename = `synthetic-reset-production-${process.pid}.db`;
    const databasePath = path.resolve(process.cwd(), "prisma", filename);
    fs.writeFileSync(databasePath, "preserve-me");
    try {
      const result = spawnSync(process.execPath, ["scripts/reset-local-database.mjs", "--yes"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, DATA_MODE: "production", DATABASE_URL: `file:./${filename}` },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Real applicant-data mode is not implemented or approved");
      expect(fs.readFileSync(databasePath, "utf8")).toBe("preserve-me");
    } finally {
      fs.rmSync(databasePath, { force: true });
    }
  });
});
