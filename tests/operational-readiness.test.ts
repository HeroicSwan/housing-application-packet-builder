import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("operational readiness contracts", () => {
  it("alerts on durable work, document, submission, and backup failures", () => {
    const alerts = fs.readFileSync("ops/prometheus-alerts.yml", "utf8");
    for (const metric of ["hapb_jobs_failed", "hapb_jobs_stale", "hapb_submissions_failed", "hapb_documents_failed", "hapb_last_backup_age_seconds"]) expect(alerts).toContain(metric);
    expect(alerts).toMatch(/severity:\s*critical/);
  });

  it("documents detection, containment, recovery, evidence, and communications", () => {
    const incident = fs.readFileSync("docs/incident-response.md", "utf8").toLowerCase();
    for (const topic of ["detect", "contain", "recover", "evidence", "communication", "credential", "personal data"]) expect(incident).toContain(topic);
    const operations = fs.readFileSync("docs/production-operations.md", "utf8").toLowerCase();
    for (const topic of ["metrics", "alert", "backup", "restore", "worker", "clamav"]) expect(operations).toContain(topic);
  });

  it("restores backups only into an explicitly confirmed disposable target", () => {
    const restore = fs.readFileSync("scripts/restore-backup.mjs", "utf8");
    expect(restore).toContain("RESTORE_TO_DISPOSABLE_DATABASE");
    expect(restore).toContain("Refusing to restore over an active application database");
    expect(restore).toContain("Restore target already exists");
  });
});
