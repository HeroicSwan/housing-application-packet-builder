import type { PacketSnapshot } from "./snapshot";

type PacketExportInput = {
  referenceNumber: string;
  version: number;
  status: string;
  generatedAt: Date;
  submittedAt: Date | null;
  approvedBy: { name: string; role: string } | null;
  fields: { fieldKey: string; fieldLabel: string; value: string; sourceType: string; sourceReference: string | null; reviewStatus: string; reviewerNote: string | null }[];
  notes: { note: string; createdAt: Date; author: { name: string; role: string } }[];
  overrides: { requirementId: string; requirementName: string; note: string; createdAt: Date; reviewer: { name: string } }[];
};

export function buildPacketExport(packet: PacketExportInput, snapshot: PacketSnapshot) {
  return {
    schema: "housing-application-packet/v1",
    notice: "Synthetic demonstration export. Human review required. This is not an eligibility or legal determination.",
    packet: {
      referenceNumber: packet.referenceNumber,
      version: packet.version,
      status: packet.status,
      generatedAt: packet.generatedAt.toISOString(),
      submittedAt: packet.submittedAt?.toISOString() ?? null,
      approvedBy: packet.approvedBy,
    },
    snapshot: {
      caseReference: snapshot.caseReference,
      client: snapshot.client,
      household: snapshot.household,
      program: snapshot.program,
      requirements: snapshot.requirements,
      documents: snapshot.documents.map(({ originalFilename, fileType, category, uploadedAt, expirationDate, processingStatus, reviewedFields }) => ({ originalFilename, fileType, category, uploadedAt, expirationDate, processingStatus, reviewedFields })),
      reviewItems: snapshot.reviewItems,
      missingInformation: snapshot.missingInformation,
    },
    fields: packet.fields.map((field) => ({ key: field.fieldKey, label: field.fieldLabel, value: field.value, sourceType: field.sourceType, sourceReference: field.sourceReference, reviewStatus: field.reviewStatus, reviewerNote: field.reviewerNote })),
    requirementOverrides: packet.overrides.map((override) => ({ requirementId: override.requirementId, requirementName: override.requirementName, note: override.note, reviewer: override.reviewer.name, createdAt: override.createdAt.toISOString() })),
    reviewNotes: packet.notes.map((note) => ({ note: note.note, author: note.author, createdAt: note.createdAt.toISOString() })),
  };
}
