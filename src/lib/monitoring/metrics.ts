import "server-only";
import { db, systemDb } from "@/lib/db";
import { runWithOrganization } from "@/lib/tenant-context";

export async function collectMetrics() {
  const organizations = await systemDb.organization.findMany({ where: { isActive: true }, select: { id: true } });
  const totals = { pendingJobs: 0, failedJobs: 0, staleJobs: 0, failedSubmissions: 0, failedDocuments: 0 };
  const stale = new Date(Date.now() - 15 * 60_000);
  for (const organization of organizations) await runWithOrganization(organization.id, async () => {
    const values = await Promise.all([
      db.backgroundJob.count({ where: { status: "PENDING" } }),
      db.backgroundJob.count({ where: { status: "FAILED" } }),
      db.backgroundJob.count({ where: { status: "PROCESSING", lockedAt: { lt: stale } } }),
      db.applicationSubmission.count({ where: { status: "FAILED" } }),
      db.uploadedDocument.count({ where: { processingStatus: "FAILED" } }),
    ]);
    totals.pendingJobs += values[0]; totals.failedJobs += values[1]; totals.staleJobs += values[2]; totals.failedSubmissions += values[3]; totals.failedDocuments += values[4];
  });
  const backup = await systemDb.backupRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" } });
  const backupAge = backup?.completedAt ? Math.floor((Date.now() - backup.completedAt.getTime()) / 1000) : -1;
  return { organizations: organizations.length, ...totals, backupAge };
}

export function renderPrometheusMetrics(metrics: Awaited<ReturnType<typeof collectMetrics>>) {
  return [
    "# HELP hapb_organizations Active tenant organizations.", `hapb_organizations ${metrics.organizations}`,
    "# HELP hapb_jobs_pending Durable jobs waiting to run.", `hapb_jobs_pending ${metrics.pendingJobs}`,
    "# HELP hapb_jobs_failed Durable jobs at terminal failure.", `hapb_jobs_failed ${metrics.failedJobs}`,
    "# HELP hapb_jobs_stale Processing jobs with expired locks.", `hapb_jobs_stale ${metrics.staleJobs}`,
    "# HELP hapb_submissions_failed Failed provider submissions.", `hapb_submissions_failed ${metrics.failedSubmissions}`,
    "# HELP hapb_documents_failed Documents requiring processing review.", `hapb_documents_failed ${metrics.failedDocuments}`,
    "# HELP hapb_last_backup_age_seconds Age of the newest verified backup, or -1 when absent.", `hapb_last_backup_age_seconds ${metrics.backupAge}`,
  ].join("\n") + "\n";
}
