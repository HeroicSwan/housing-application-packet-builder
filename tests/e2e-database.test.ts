import path from "node:path";
import { describe, expect, it } from "vitest";
import { createE2eDatabaseTarget, resolveE2eDatabaseUrl } from "../scripts/e2e-database.mjs";

const repositoryRoot = path.resolve("synthetic-e2e-repository");

describe("E2E database selection", () => {
  it("creates a database directly inside the isolated Prisma directory", () => {
    const target = createE2eDatabaseTarget(repositoryRoot, "run-123");
    expect(target.databaseUrl).toBe("file:./.e2e/e2e-run-123.db");
    expect(path.dirname(target.databasePath)).toBe(path.resolve(repositoryRoot, "prisma", ".e2e"));
  });

  it("uses a separate database for each run identifier", () => {
    const first = createE2eDatabaseTarget(repositoryRoot, "run-one");
    const second = createE2eDatabaseTarget(repositoryRoot, "run-two");
    expect(first.databasePath).not.toBe(second.databasePath);
  });

  it.each([
    "file:./dev.db",
    "file:./production.db",
    "file:/absolute/e2e.db",
    "file:./.e2e/../dev.db",
    "file:./.e2e/nested/e2e-run.db",
    "file:.\\.e2e\\e2e-run.db",
    "postgresql://localhost/e2e",
  ])("rejects an unsafe database URL: %s", (databaseUrl) => {
    expect(() => resolveE2eDatabaseUrl(repositoryRoot, databaseUrl)).toThrow(
      "E2E_DATABASE_URL must select a generated database directly under prisma/.e2e.",
    );
  });
});
