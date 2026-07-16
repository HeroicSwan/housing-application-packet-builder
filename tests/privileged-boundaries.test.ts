import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

describe("privileged database boundaries", () => {
  it("limits the production system client to approved authentication and operational boundaries", () => {
    const allowed = new Set([
      "src/app/actions/auth.ts",
      "src/app/api/health/route.ts",
      "src/lib/auth/rate-limit.ts",
      "src/lib/auth/session.ts",
      "src/lib/jobs/index.ts",
      "src/lib/monitoring/metrics.ts",
      "src/lib/secure-downloads.ts",
      "src/lib/setup/bootstrap.ts",
    ]);
    const imports = sourceFiles(path.join(process.cwd(), "src")).filter((filename) => fs.readFileSync(filename, "utf8").match(/import .*\bsystemDb\b/)).map((filename) => path.relative(process.cwd(), filename).replaceAll("\\", "/"));
    expect(imports.sort()).toEqual([...allowed].sort());
  });

  it("does not allow unsafe raw SQL in application source", () => {
    const violations = sourceFiles(path.join(process.cwd(), "src")).filter((filename) => /\$(?:queryRawUnsafe|executeRawUnsafe)/.test(fs.readFileSync(filename, "utf8"))).map((filename) => path.relative(process.cwd(), filename));
    expect(violations).toEqual([]);
  });

  it("keeps the system database role on explicit table and column grants", () => {
    const grants = fs.readFileSync("scripts/grant-production-roles.sql", "utf8");
    expect(grants).not.toMatch(/GRANT .*ALL TABLES.*hapb_system/i);
    expect(grants).toContain('GRANT SELECT ON "Organization" TO hapb_system;');
    expect(grants).toContain('GRANT UPDATE ("failedLoginCount", "lockedUntil", "passwordHash", "passwordChangedAt", "mfaRecoveryCodesEncrypted") ON "User" TO hapb_system;');
    expect(grants).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON "AuthSession", "MfaChallenge", "PasswordResetToken", "RateLimitBucket", "BackupRun" TO hapb_system;');
    expect(grants).toContain('GRANT SELECT, UPDATE ("downloadCount", "lastDownloadedAt") ON "SecureDownload" TO hapb_system;');
  });
});
