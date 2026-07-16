import { NextResponse } from "next/server";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteObject, getObject } from "@/lib/storage";
import { sha256 } from "@/lib/security/encryption";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const { requestId } = await params;
  const lifecycleRequest = await db.dataLifecycleRequest.findUnique({ where: { id: requestId } });
  const unavailable = !lifecycleRequest || lifecycleRequest.requestType !== "EXPORT" || lifecycleRequest.status !== "COMPLETED" || !lifecycleRequest.exportStorageKey;
  const expired = Boolean(lifecycleRequest?.exportExpiresAt && lifecycleRequest.exportExpiresAt <= new Date());
  const exhausted = Boolean(lifecycleRequest && lifecycleRequest.downloadCount >= lifecycleRequest.maxDownloads);
  if (unavailable || expired || exhausted) {
    if (lifecycleRequest) {
      if ((expired || exhausted) && lifecycleRequest.exportStorageKey) await deleteObject(lifecycleRequest.exportStorageKey);
      await db.$transaction([
        db.dataLifecycleRequest.update({ where: { id: lifecycleRequest.id }, data: { accessFailureCount: { increment: 1 }, ...(expired || exhausted ? { status: "EXPIRED", exportStorageKey: null, cleanedUpAt: new Date() } : {}) } }),
        db.auditEvent.create({ data: { userId: user.id, clientCaseId: lifecycleRequest.clientCaseId, action: "CASE_EXPORT_ACCESS_DENIED", entityType: "DataLifecycleRequest", entityId: lifecycleRequest.id, metadata: expired ? "Export expired" : exhausted ? "Export download limit reached" : "Export unavailable" } }),
      ]);
    }
    return NextResponse.json({ error: "Export not found or no longer available." }, { status: 404 });
  }
  const bytes = await getObject(lifecycleRequest.exportStorageKey!);
  if (lifecycleRequest.checksum && sha256(bytes) !== lifecycleRequest.checksum) {
    await db.$transaction([
      db.dataLifecycleRequest.update({ where: { id: lifecycleRequest.id }, data: { accessFailureCount: { increment: 1 } } }),
      db.auditEvent.create({ data: { userId: user.id, clientCaseId: lifecycleRequest.clientCaseId, action: "CASE_EXPORT_INTEGRITY_FAILED", entityType: "DataLifecycleRequest", entityId: lifecycleRequest.id, metadata: "Encrypted export failed checksum verification" } }),
    ]);
    return NextResponse.json({ error: "Export integrity check failed." }, { status: 500 });
  }
  const reserved = await db.dataLifecycleRequest.updateMany({ where: { id: lifecycleRequest.id, status: "COMPLETED", exportStorageKey: { not: null }, downloadCount: { lt: lifecycleRequest.maxDownloads }, exportExpiresAt: { gt: new Date() } }, data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() } });
  if (reserved.count !== 1) return NextResponse.json({ error: "Export not found or no longer available." }, { status: 404 });
  await db.$transaction([
    db.auditEvent.create({ data: { userId: user.id, clientCaseId: lifecycleRequest.clientCaseId, action: "CASE_EXPORT_DOWNLOADED", entityType: "DataLifecycleRequest", entityId: lifecycleRequest.id, metadata: "Authorized encrypted export download completed" } }),
  ]);
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/gzip", "content-disposition": `attachment; filename="case-export-${requestId}.json.gz"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
