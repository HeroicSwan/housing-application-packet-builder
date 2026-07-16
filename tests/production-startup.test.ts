import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production startup boundary", () => {
  it("forces production enforcement and reports only redacted validation issues", () => {
    const secretCanary = "NeverPrintThisSensitiveCanary_7Kq4pZ9vN2xR8mT5wY1cF6j";
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/start-production.ts", "--config-only"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATA_MODE: "synthetic",
        ENFORCE_PRODUCTION_CONFIG: "false",
        SESSION_SECRET: secretCanary,
        DOCUMENT_PROCESSOR: "mock",
        DATABASE_URL: "file:./dev.db",
        ENABLE_DEMO_LOGIN: "true",
        DEMO_BANNER: "true",
        SECURE_COOKIES: "false",
      },
    });
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain("Production enforcement requires DATA_MODE=production");
    expect(output).toContain("Demo login must be disabled");
    expect(output).not.toContain(secretCanary);
  });
});
