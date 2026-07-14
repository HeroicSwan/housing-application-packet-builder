export type PacketStatus = "DRAFT" | "READY_FOR_REVIEW" | "IN_REVIEW" | "NEEDS_CORRECTION" | "APPROVED" | "ARCHIVED";

const transitions: Record<PacketStatus, readonly PacketStatus[]> = {
  DRAFT: ["READY_FOR_REVIEW"],
  READY_FOR_REVIEW: ["IN_REVIEW", "NEEDS_CORRECTION"],
  IN_REVIEW: ["NEEDS_CORRECTION", "APPROVED"],
  NEEDS_CORRECTION: [],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionPacket(from: string, to: PacketStatus) {
  return from in transitions && transitions[from as PacketStatus].includes(to);
}

export function assertPacketTransition(from: string, to: PacketStatus) {
  if (!canTransitionPacket(from, to)) throw new Error(`A packet cannot move from ${from} to ${to}.`);
}
