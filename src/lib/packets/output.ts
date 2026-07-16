import { db } from "@/lib/db";
import { generatePacketPdf } from "@/lib/packets/pdf";
import { parsePacketSnapshot } from "@/lib/packets/snapshot";
import { packetApprovalDigest } from "@/lib/packets/integrity";

export async function generatePacketOutput(packetId: string) {
  const packet = await db.applicationPacket.findUniqueOrThrow({ where: { id: packetId }, include: { fields: true, reviewNotes: true, requirementOverrides: true } });
  if (packet.status === "APPROVED" && (!packet.approvalDigest || packet.approvalDigest !== packetApprovalDigest(packet))) throw new Error("The approved packet no longer matches its immutable approval digest.");
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
  return { packet, bytes };
}
