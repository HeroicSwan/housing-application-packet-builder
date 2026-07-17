import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("data lifecycle acceptance", () => {
  it("creates and decrypts a complete export, then performs approved deletion with evidence", () => {
    const suffix = randomUUID();
    const databaseName = `lifecycle-test-${suffix}.db`;
    const databasePath = path.resolve("prisma", databaseName);
    const storageRoot = path.join(".data", `lifecycle-test-${suffix}`);
    const storagePath = path.resolve(storageRoot);
    fs.closeSync(fs.openSync(databasePath, "w"));
    try {
      const environment = { ...process.env, DATABASE_URL: `file:./${databaseName}`, DATA_MODE: "synthetic", DOCUMENT_PROCESSOR: "mock", LOCAL_STORAGE_ROOT: storageRoot, DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), DATA_ENCRYPTION_KEY_ID: "lifecycle-test" };
      const prisma = spawnSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], { cwd: process.cwd(), env: environment, encoding: "utf8" });
      if (prisma.status !== 0) throw new Error(prisma.stderr || prisma.stdout);
      const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/verify-data-lifecycle.ts"], { cwd: process.cwd(), env: environment, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout.trim())).toEqual({ durableJobVerified: true, exportVerified: true, encryptedObjectVerified: true, caseDeleted: true, deletionEvidence: true });
    } finally {
      for (const suffixName of ["", "-journal", "-shm", "-wal"]) fs.rmSync(`${databasePath}${suffixName}`, { force: true });
      fs.rmSync(storagePath, { force: true, recursive: true });
    }
  }, 30_000);
});
