import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

describe("authenticated organization context boundaries", () => {
  it("activates tenant context in the caller after every authentication await", () => {
    const violations: string[] = [];
    for (const filename of sourceFiles(path.join(process.cwd(), "src", "app"))) {
      const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/await (?:requireUser|requireRole|getCurrentUser)\(/.test(line) && !line.includes("activateOrganizationContext(")) {
          violations.push(`${path.relative(process.cwd(), filename)}:${index + 1}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it("reactivates tenant context after session creation before tenant writes", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "app", "actions", "auth.ts"), "utf8");
    const lines = source.split(/\r?\n/);
    const violations = lines.flatMap((line, index) => {
      if (!line.includes("await createSession(")) return [];
      return `${line} ${lines[index + 1] ?? ""}`.includes("activateOrganizationContext(") ? [] : [index + 1];
    });
    expect(violations).toEqual([]);
  });
});
