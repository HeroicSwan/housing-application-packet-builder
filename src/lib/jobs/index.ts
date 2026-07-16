import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, systemDb } from "@/lib/db";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { requireOrganizationContext, runWithOrganization } from "@/lib/tenant-context";
import { processStoredDocument } from "@/lib/document-processing/service";
import { deliverApplication } from "@/lib/submissions";
import { cleanupExpiredExports, executeDueDeletions, scheduleExpiredCases } from "@/lib/data-lifecycle";
import { recordAudit } from "@/lib/audit";

const documentJob = z.object({ documentId: z.string().cuid(), userId: z.string().cuid() });
const deliveryJob = z.object({ draftId: z.string().cuid(), destinationId: z.string().cuid(), userId: z.string().cuid(), clientCaseId: z.string().cuid() });

export async function enqueueBackgroundJob(jobType: "PROCESS_DOCUMENT" | "DELIVER_APPLICATION" | "ENFORCE_RETENTION", payload: unknown, dedupeKey: string) {
  const organizationId = requireOrganizationContext();
  return db.backgroundJob.upsert({
    where: { organizationId_dedupeKey: { organizationId, dedupeKey } },
    create: { jobType, payloadEncrypted: encryptText(JSON.stringify(payload)), dedupeKey },
    update: {},
  });
}

async function handleJob(job: { jobType: string; payloadEncrypted: string }) {
  const payload = JSON.parse(decryptText(job.payloadEncrypted));
  if (job.jobType === "PROCESS_DOCUMENT") {
    const input = documentJob.parse(payload);
    await processStoredDocument(input.documentId, input.userId);
    return;
  }
  if (job.jobType === "DELIVER_APPLICATION") {
    const input = deliveryJob.parse(payload);
    const submission = await deliverApplication(input.draftId, input.destinationId);
    await recordAudit({ userId: input.userId, clientCaseId: input.clientCaseId, action: "APPLICATION_DELIVERED", entityType: "ApplicationSubmission", entityId: submission.id, metadata: `Durable delivery completed with status ${submission.status}` });
    return;
  }
  if (job.jobType === "ENFORCE_RETENTION") {
    await scheduleExpiredCases();
    await executeDueDeletions();
    await cleanupExpiredExports();
    return;
  }
  throw new Error(`Unsupported background job type: ${job.jobType}`);
}

export async function runNextOrganizationJob(workerId: string = randomUUID()) {
  const now = new Date();
  const stale = new Date(now.getTime() - 15 * 60_000);
  const candidate = await db.backgroundJob.findFirst({ where: { OR: [{ status: "PENDING", runAfter: { lte: now } }, { status: "PROCESSING", lockedAt: { lt: stale } }] }, orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }] });
  if (!candidate) return false;
  const claimed = await db.backgroundJob.updateMany({ where: { id: candidate.id, OR: [{ status: "PENDING" }, { status: "PROCESSING", lockedAt: { lt: stale } }] }, data: { status: "PROCESSING", lockedAt: now, lockedBy: workerId, attempts: { increment: 1 } } });
  if (claimed.count !== 1) return false;
  const job = await db.backgroundJob.findUniqueOrThrow({ where: { id: candidate.id } });
  try {
    await handleJob(job);
    await db.backgroundJob.update({ where: { id: job.id }, data: { status: "COMPLETED", lockedAt: null, lockedBy: null, completedAt: new Date(), lastError: null } });
  } catch (error) {
    const terminal = job.attempts >= job.maxAttempts;
    const delay = Math.min(60 * 60_000, 2 ** Math.min(job.attempts, 10) * 1000);
    const nextAttemptAt = new Date(Date.now() + delay);
    await db.backgroundJob.update({ where: { id: job.id }, data: { status: terminal ? "DEAD_LETTER" : "PENDING", lockedAt: null, lockedBy: null, runAfter: nextAttemptAt, lastError: error instanceof z.ZodError ? "JOB_PAYLOAD_INVALID" : "JOB_EXECUTION_FAILED", completedAt: terminal ? new Date() : null } });
    if (job.jobType === "DELIVER_APPLICATION") {
      const input = deliveryJob.safeParse(JSON.parse(decryptText(job.payloadEncrypted)));
      if (input.success) await db.applicationSubmission.updateMany({ where: { draftId: input.data.draftId, destinationId: input.data.destinationId, status: { not: "SUBMITTED" } }, data: { status: terminal ? "DEAD_LETTER" : "FAILED", outcomeStatus: "UNKNOWN", nextAttemptAt: terminal ? null : nextAttemptAt, deadLetteredAt: terminal ? new Date() : null, errorMessage: terminal ? "Delivery exhausted the retry policy and requires manual review." : "Delivery failed and is scheduled for a safe retry." } });
    }
  }
  return true;
}

export async function runWorkerSweep(workerId: string = randomUUID(), maxJobsPerOrganization = 25) {
  const organizations = await systemDb.organization.findMany({ where: { isActive: true }, select: { id: true } });
  let processed = 0;
  for (const organization of organizations) {
    await runWithOrganization(organization.id, async () => {
      const retentionDay = new Date().toISOString().slice(0, 10);
      await enqueueBackgroundJob("ENFORCE_RETENTION", {}, `retention:${retentionDay}`);
      for (let index = 0; index < maxJobsPerOrganization; index += 1) {
        if (!(await runNextOrganizationJob(workerId))) break;
        processed += 1;
      }
    });
  }
  return processed;
}
