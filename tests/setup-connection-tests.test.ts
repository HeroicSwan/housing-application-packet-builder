import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { probeStorage } from "@/lib/setup/connection-tests/storage";
import { testDatabasePermissions } from "@/lib/database/preflight";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("setup connection tests", () => {
  it("writes, verifies, deletes, and confirms deletion of a synthetic encrypted storage object", async () => {
    const localRoot = `setup-probe-${randomUUID()}`;
    roots.push(path.resolve(".data", localRoot));
    const result = await probeStorage({ provider: "local", localRoot, region: "us-east-1" });
    expect(result.status).toBe("PASSED");
    expect(result.code).toBe("STORAGE_ROUND_TRIP_OK");
    expect(JSON.stringify(result)).not.toContain("setup-tests/storage/");
    const remaining = await fs.readdir(path.resolve(".data", localRoot, "setup-tests", "storage")).catch(() => []);
    expect(remaining).toEqual([]);
  });

  it("labels the local SQLite permissions check as simulated, never passed", async () => {
    const result = await testDatabasePermissions();
    expect(result).toMatchObject({ status: "SIMULATED", code: "DATABASE_SQLITE_DEMO" });
  });
});
