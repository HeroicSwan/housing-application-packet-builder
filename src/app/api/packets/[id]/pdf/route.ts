import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessPacket, getCurrentUser } from "@/lib/auth/session";
import { generatePacketPdf } from "@/lib/packets/pdf";
import { parsePacketSnapshot } from "@/lib/packets/snapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return new NextResponse("Unauthorized", { status: 401 }); const { id } = await params;
  if (!(await canAccessPacket(user, id))) return new NextResponse("Forbidden", { status: 403 });
  const packet = await db.applicationPacket.findUnique({ where: { id }, include: { fields: true, reviewNotes: true, requirementOverrides: true } });
  if (!packet) return new NextResponse("Not found", { status: 404 });
  try {
    const snapshot = parsePacketSnapshot(packet.snapshotJson);
    const bytes = await generatePacketPdf({
      referenceNumber: packet.referenceNumber,
      version: packet.version,
      generatedAt: packet.generatedAt,
      clientName: snapshot.client.legalName,
      clientSummary: [`Preferred name: ${snapshot.client.preferredName ?? "Not provided"}`, `Date of birth: ${snapshot.client.dateOfBirth ?? "Not provided"}`, `Current living situation: ${snapshot.client.currentLivingSituation ?? "Not provided"}`],
      household: snapshot.household.map((member) => `${member.name} (${member.relationship})`),
      programName: snapshot.program.name,
      requirements: snapshot.requirements.map((item) => ({ name: item.name, state: item.state, reason: item.reason })),
      fields: packet.fields.map((field) => ({ label: field.fieldLabel, value: field.value, source: field.sourceReference ?? field.sourceType })),
      documents: snapshot.documents.map((document) => `${document.originalFilename} - ${document.category}`),
      missingInformation: snapshot.missingInformation,
      notes: [...packet.reviewNotes.map((note) => note.note), ...packet.requirementOverrides.map((override) => `Override - ${override.requirementName}: ${override.note}`)],
    });
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${packet.referenceNumber}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Packet snapshot is unavailable or invalid.", { status: 422 });
  }
}
