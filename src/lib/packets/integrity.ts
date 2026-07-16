import { sha256 } from "@/lib/security/encryption";

export function packetApprovalDigest(packet: {
  snapshotJson: string;
  fields: { id: string; value: string; reviewStatus: string; reviewerNote: string | null }[];
  requirementOverrides: { requirementId: string; note: string }[];
  reviewNotes?: { id: string; note: string }[];
}) {
  return sha256(JSON.stringify({
    snapshot: JSON.parse(packet.snapshotJson),
    fields: [...packet.fields].sort((a, b) => a.id.localeCompare(b.id)),
    overrides: [...packet.requirementOverrides].sort((a, b) => a.requirementId.localeCompare(b.requirementId)),
    notes: [...(packet.reviewNotes ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
  }));
}
