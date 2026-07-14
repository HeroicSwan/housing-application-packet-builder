import { describe, expect, it } from "vitest";
import { MockDocumentProcessor } from "@/lib/document-processing/mock";
import { evaluateRequirements } from "@/lib/requirements/engine";
import { canApprovePacket } from "@/lib/packets/approval";

describe("case-to-review workflow integration", () => {
  it("moves deterministic evidence through extraction, matching, and approval", async () => {
    const extraction = await new MockDocumentProcessor().processDocument({ filename: "sample-id.pdf", mimeType: "application/pdf", bytes: new Uint8Array() });
    const requirement = evaluateRequirements([{ id: "identity", name: "Identification", category: "IDENTITY", isRequired: true }], [{ category: extraction.category, expirationDate: new Date(extraction.expirationDate!), reviewStatuses: extraction.fields.map(() => "APPROVED") }], [], undefined, new Date("2026-07-12"));
    const approval = canApprovePacket({ status: "IN_REVIEW", fields: [{ isRequired: true, reviewStatus: "APPROVED" }], unresolvedConflicts: 0, requirements: requirement.map((item) => ({ ...item, overridden: false })) });
    expect(requirement[0].state).toBe("SATISFIED"); expect(approval.allowed).toBe(true);
  });
});
