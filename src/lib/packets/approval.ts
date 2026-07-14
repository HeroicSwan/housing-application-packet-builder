export type ApprovalInput = {
  status: string;
  fields: { fieldLabel?: string; isRequired: boolean; reviewStatus: string }[];
  unresolvedConflicts: number;
  requirements: { id: string; name: string; isRequired: boolean; state: string; overridden: boolean }[];
};

export function canApprovePacket(input: ApprovalInput) {
  const reasons: string[] = [];
  if (input.status !== "IN_REVIEW") reasons.push("Start the review before approving this packet.");
  const unreviewed = input.fields.filter((field) => field.isRequired && field.reviewStatus !== "APPROVED");
  if (unreviewed.length) reasons.push(`${unreviewed.length} required packet field${unreviewed.length === 1 ? " still needs" : "s still need"} approval.`);
  if (input.unresolvedConflicts > 0) reasons.push(`${input.unresolvedConflicts} unresolved conflict${input.unresolvedConflicts === 1 ? " must" : "s must"} be corrected in a new packet version.`);
  for (const requirement of input.requirements.filter((item) => item.isRequired && item.state !== "SATISFIED" && !item.overridden)) reasons.push(`${requirement.name} is ${requirement.state.toLowerCase().replaceAll("_", " ")} and needs a written reviewer override.`);
  return { allowed: reasons.length === 0, reasons };
}
