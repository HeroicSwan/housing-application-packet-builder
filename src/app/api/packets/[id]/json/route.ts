import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessPacket, getCurrentUser } from "@/lib/auth/session";
import { buildPacketExport } from "@/lib/packets/export";
import { parsePacketSnapshot } from "@/lib/packets/snapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return new NextResponse("Unauthorized", { status: 401 }); const { id } = await params;
  if (!(await canAccessPacket(user, id))) return new NextResponse("Forbidden", { status: 403 });
  const packet = await db.applicationPacket.findUnique({ where: { id }, include: { fields: true, reviewNotes: { include: { author: { select: { name: true, role: true } } } }, requirementOverrides: { include: { reviewer: { select: { name: true } } } }, approvedBy: { select: { name: true, role: true } } } });
  if (!packet) return new NextResponse("Not found", { status: 404 });
  try {
    const exported = buildPacketExport({ ...packet, notes: packet.reviewNotes, overrides: packet.requirementOverrides }, parsePacketSnapshot(packet.snapshotJson));
    return NextResponse.json(exported, { headers: { "Content-Disposition": `attachment; filename="${packet.referenceNumber}.json"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Packet snapshot is unavailable or invalid.", { status: 422 });
  }
}
