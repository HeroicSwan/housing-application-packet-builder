import "server-only";
import crypto from "node:crypto";
import { db, systemDb } from "@/lib/db";
import { sha256 } from "@/lib/security/encryption";
import { runWithOrganization } from "@/lib/tenant-context";

export async function createSecureDownload(input: { organizationId: string; createdById: string; resourceType: "PACKET_PDF"; resourceId: string; ttlMinutes?: number; maxDownloads?: number }) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.secureDownload.create({ data: { organizationId: input.organizationId, createdById: input.createdById, resourceType: input.resourceType, resourceId: input.resourceId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + (input.ttlMinutes ?? 15) * 60_000), maxDownloads: input.maxDownloads ?? 1 } });
  return token;
}

export async function consumeSecureDownload(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const record = await systemDb.secureDownload.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record?.organizationId || record.revokedAt || record.expiresAt <= new Date() || record.downloadCount >= record.maxDownloads) return null;
  const consumed = await systemDb.secureDownload.updateMany({ where: { id: record.id, downloadCount: record.downloadCount, revokedAt: null, expiresAt: { gt: new Date() } }, data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() } });
  if (consumed.count !== 1) return null;
  return runWithOrganization(record.organizationId, async () => db.secureDownload.findUnique({ where: { id: record.id } }));
}
