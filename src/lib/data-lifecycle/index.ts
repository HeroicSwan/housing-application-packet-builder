import { gzipSync } from "node:zlib";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getLegacyOrStoredObject, putObject, deleteObject } from "@/lib/storage";

const caseExportInclude = {
  assignedCaseworker: { select: { id: true, name: true, email: true, role: true } },
  selectedProgram: { include: { requirements: true } },
  householdMembers: { include: { incomeRecords: true } },
  incomeRecords: true,
  documents: { include: { extractedFields: true } },
  packets: { include: { fields: true, reviewNotes: true, requirementOverrides: true } },
  applicationDrafts: { include: { fields: true, documents: true, signature: true, consents: true, submissions: true, template: { include: { fields: true } } } },
  consents: true,
} as const;

export async function exportCaseData(clientCaseId: string, userId: string, reason = "Authorized case export requested by an administrator.") {
  const clientCase = await db.clientCase.findUnique({ where: { id: clientCaseId }, include: caseExportInclude });
  if (!clientCase) throw new Error("Case not found.");
  const request = await db.dataLifecycleRequest.create({ data: { clientCaseId, requestedById: userId, approvedById: userId, requestType: "EXPORT", status: "IN_PROGRESS", reason, exportExpiresAt: new Date(Date.now() + 24 * 60 * 60_000), maxDownloads: 3 } });
  try {
    const documents = await Promise.all(clientCase.documents.map(async (document) => ({
      id: document.id,
      originalFilename: document.originalFilename,
      fileType: document.fileType,
      checksum: document.checksumSha256,
      bytesBase64: Buffer.from(await getLegacyOrStoredObject(document)).toString("base64"),
    })));
    const auditEvents = await db.auditEvent.findMany({ where: { clientCaseId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const payload = gzipSync(Buffer.from(JSON.stringify({ schema: "housing-application-case-export/v1", exportedAt: new Date().toISOString(), clientCase, documents, auditEvents })));
    const stored = await putObject(`exports/${clientCaseId}/${request.id}.json.gz`, payload, "application/gzip");
    const completed = await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", exportStorageKey: stored.key, checksum: stored.checksum, completedAt: new Date() } });
    await recordAudit({ userId, clientCaseId, action: "CASE_DATA_EXPORTED", entityType: "DataLifecycleRequest", entityId: request.id, metadata: "Encrypted case export created; contents not logged" });
    return completed;
  } catch (error) {
    await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "FAILED", errorMessage: "Export creation failed. Review protected server logs and storage health.", completedAt: new Date() } });
    throw error;
  }
}

export async function requestCaseDeletion(clientCaseId: string, userId: string, reason: string) {
  const clientCase = await db.clientCase.findUnique({ where: { id: clientCaseId }, select: { id: true, legalHoldAt: true, organization: { select: { deletionGraceDays: true } } } });
  if (!clientCase) throw new Error("Case not found.");
  if (clientCase.legalHoldAt) throw new Error("A case under legal hold cannot be scheduled for deletion.");
  const executeAfter = new Date(Date.now() + clientCase.organization!.deletionGraceDays * 86_400_000);
  const request = await db.dataLifecycleRequest.create({ data: { clientCaseId, requestedById: userId, requestType: "DELETE", reason, executeAfter } });
  await recordAudit({ userId, clientCaseId, action: "CASE_DELETION_REQUESTED", entityType: "DataLifecycleRequest", entityId: request.id, metadata: `Deletion scheduled with ${clientCase.organization!.deletionGraceDays}-day approval window` });
  return request;
}

export async function approveCaseDeletion(requestId: string, approverId: string) {
  const request = await db.dataLifecycleRequest.findUnique({ where: { id: requestId }, include: { clientCase: true } });
  if (!request || request.requestType !== "DELETE" || request.status !== "PENDING" || !request.clientCase) throw new Error("Pending deletion request not found.");
  if (request.requestedById === approverId) throw new Error("Deletion requires approval by a different administrator.");
  if (request.clientCase.legalHoldAt) throw new Error("A case under legal hold cannot be approved for deletion.");
  const approved = await db.dataLifecycleRequest.update({ where: { id: requestId }, data: { status: "APPROVED", approvedById: approverId } });
  await recordAudit({ userId: approverId, clientCaseId: request.clientCaseId!, action: "CASE_DELETION_APPROVED", entityType: "DataLifecycleRequest", entityId: requestId, metadata: "A second administrator approved the deletion request" });
  return approved;
}

export async function cancelCaseDeletion(requestId: string, userId: string) {
  const request = await db.dataLifecycleRequest.findUnique({ where: { id: requestId } });
  if (!request || request.requestType !== "DELETE" || !["PENDING", "APPROVED"].includes(request.status)) throw new Error("Cancelable deletion request not found.");
  const canceled = await db.dataLifecycleRequest.update({ where: { id: requestId }, data: { status: "CANCELED", completedAt: new Date(), approvedById: userId } });
  await recordAudit({ userId, clientCaseId: request.clientCaseId ?? undefined, action: "CASE_DELETION_CANCELED", entityType: "DataLifecycleRequest", entityId: requestId, metadata: "Scheduled deletion canceled" });
  return canceled;
}

export async function setLegalHold(clientCaseId: string, userId: string, reason: string | null) {
  const active = Boolean(reason);
  const clientCase = await db.clientCase.update({ where: { id: clientCaseId }, data: { legalHoldAt: active ? new Date() : null, legalHoldReason: reason } });
  if (active) await db.dataLifecycleRequest.updateMany({ where: { clientCaseId, requestType: "DELETE", status: { in: ["PENDING", "APPROVED", "IN_PROGRESS"] } }, data: { status: "CANCELED", completedAt: new Date() } });
  await recordAudit({ userId, clientCaseId, action: active ? "LEGAL_HOLD_PLACED" : "LEGAL_HOLD_RELEASED", entityType: "ClientCase", entityId: clientCaseId, metadata: active ? "Legal hold placed; reason retained in protected case record" : "Legal hold released" });
  return clientCase;
}

export async function scheduleExpiredCases(now = new Date()) {
  const organization = await db.organization.findFirstOrThrow({ include: { users: { where: { role: "ADMIN", isActive: true }, take: 1 } } });
  const systemActor = organization.users[0];
  if (!systemActor) throw new Error("Retention enforcement requires an active organization administrator for accountability.");
  const cases = await db.clientCase.findMany({ where: { legalHoldAt: null }, select: { id: true, createdAt: true, retentionExpiresAt: true, lifecycleRequests: { where: { requestType: "DELETE", status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } } } });
  let scheduled = 0;
  for (const clientCase of cases) {
    const expiresAt = clientCase.retentionExpiresAt ?? new Date(clientCase.createdAt.getTime() + organization.retentionDays * 86_400_000);
    if (!clientCase.retentionExpiresAt) await db.clientCase.update({ where: { id: clientCase.id }, data: { retentionExpiresAt: expiresAt } });
    if (expiresAt <= now && clientCase.lifecycleRequests.length === 0) {
      await db.dataLifecycleRequest.create({ data: { clientCaseId: clientCase.id, requestedById: systemActor.id, requestType: "DELETE", status: "PENDING", reason: "Organization retention policy", executeAfter: new Date(now.getTime() + organization.deletionGraceDays * 86_400_000) } });
      scheduled += 1;
    }
  }
  return scheduled;
}

export async function executeDueDeletions(now = new Date()) {
  const requests = await db.dataLifecycleRequest.findMany({ where: { requestType: "DELETE", status: "APPROVED", executeAfter: { lte: now }, clientCaseId: { not: null } } });
  let completed = 0;
  for (const request of requests) {
    const clientCase = await db.clientCase.findUnique({ where: { id: request.clientCaseId! }, include: { documents: { select: { storageKey: true } } } });
    if (!clientCase || clientCase.legalHoldAt) continue;
    const claimed = await db.dataLifecycleRequest.updateMany({ where: { id: request.id, requestType: "DELETE", status: "APPROVED", executeAfter: { lte: now } }, data: { status: "IN_PROGRESS" } });
    if (claimed.count !== 1) continue;
    try {
      const beforeObjects = await db.clientCase.findUnique({ where: { id: clientCase.id }, select: { legalHoldAt: true } });
      if (!beforeObjects || beforeObjects.legalHoldAt) {
        await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "CANCELED", completedAt: new Date(), errorMessage: "Deletion canceled because a legal hold was placed." } });
        continue;
      }
      for (const document of clientCase.documents) if (document.storageKey) await deleteObject(document.storageKey);
      const stillEligible = await db.clientCase.deleteMany({ where: { id: clientCase.id, legalHoldAt: null } });
      if (stillEligible.count !== 1) {
        await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "CANCELED", completedAt: new Date(), errorMessage: "Deletion canceled because a legal hold was placed." } });
        continue;
      }
      await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await recordAudit({ userId: request.approvedById ?? request.requestedById!, action: "CASE_DELETION_COMPLETED", entityType: "ClientCase", entityId: clientCase.id, metadata: "Case records and managed document objects deleted under approved policy" });
      completed += 1;
    } catch {
      await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "FAILED", errorMessage: "Deletion failed. Review protected storage and database logs.", completedAt: new Date() } });
    }
  }
  return completed;
}

export async function cleanupExpiredExports(now = new Date()) {
  const candidates = await db.dataLifecycleRequest.findMany({ where: { requestType: "EXPORT", exportStorageKey: { not: null }, cleanedUpAt: null } });
  const requests = candidates.filter((request) => Boolean(request.exportExpiresAt && request.exportExpiresAt <= now) || request.downloadCount >= request.maxDownloads);
  let cleaned = 0;
  for (const request of requests) {
    if (request.exportStorageKey) await deleteObject(request.exportStorageKey);
    await db.dataLifecycleRequest.update({ where: { id: request.id }, data: { status: "EXPIRED", exportStorageKey: null, cleanedUpAt: now } });
    if (request.requestedById) await recordAudit({ userId: request.requestedById, clientCaseId: request.clientCaseId ?? undefined, action: "CASE_EXPORT_EXPIRED", entityType: "DataLifecycleRequest", entityId: request.id, metadata: "Expired export object automatically removed" });
    cleaned += 1;
  }
  return cleaned;
}
