import { NextResponse } from "next/server";
import { consumeSecureDownload } from "@/lib/secure-downloads";
import { generatePacketOutput } from "@/lib/packets/output";
import { db } from "@/lib/db";
import { runWithOrganization } from "@/lib/tenant-context";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const download = await consumeSecureDownload(token);
  if (!download?.organizationId || download.resourceType !== "PACKET_PDF") return new NextResponse("Download link is invalid or expired.", { status: 404, headers: { "cache-control": "no-store" } });
  try {
    const { packet, bytes } = await runWithOrganization(download.organizationId, async () => {
      const output = await generatePacketOutput(download.resourceId);
      await db.auditEvent.create({ data: { organizationId: download.organizationId, userId: download.createdById, clientCaseId: output.packet.clientCaseId, action: "SECURE_PACKET_DOWNLOADED", entityType: "SecureDownload", entityId: download.id, metadata: "One expiring packet download was consumed" } });
      return output;
    });
    return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${packet.referenceNumber}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
  } catch {
    return new NextResponse("The approved packet is unavailable.", { status: 422, headers: { "cache-control": "no-store" } });
  }
}
