import { describe, expect, it } from "vitest";
import { canAccessRole, hasPermission } from "@/lib/auth/authorization";
import { sanitizeFilename, validateFileSignature, validateUpload } from "@/lib/validation/files";
import { canApprovePacket } from "@/lib/packets/approval";
import { canTransitionPacket } from "@/lib/packets/lifecycle";

describe("role authorization", () => {
  it("keeps administration restricted", () => { expect(hasPermission("ADMIN", "program:write")).toBe(true); expect(hasPermission("CASEWORKER", "program:write")).toBe(false); expect(canAccessRole("REVIEWER", ["ADMIN"])).toBe(false); });
});

describe("file safety", () => {
  it("removes traversal and unsafe filename characters", () => expect(sanitizeFilename("../../Client Record #1.PDF")).toBe("Client-Record-1.pdf"));
  it("rejects mismatched file types", () => expect(validateUpload({ name: "photo.exe", type: "image/jpeg", size: 20 }, 8).valid).toBe(false));
  it("checks file signatures instead of trusting MIME metadata", () => { expect(validateFileSignature(new TextEncoder().encode("%PDF-1.4 synthetic"), "application/pdf")).toBe(true); expect(validateFileSignature(new TextEncoder().encode("not a pdf"), "application/pdf")).toBe(false); });
});

describe("packet approval rules", () => {
  it("blocks unresolved fields and conflicts", () => { const result = canApprovePacket({ status: "IN_REVIEW", fields: [{ isRequired: true, reviewStatus: "PENDING" }], unresolvedConflicts: 1, requirements: [{ id: "r1", name: "Identification", isRequired: true, state: "MISSING", overridden: false }] }); expect(result.allowed).toBe(false); expect(result.reasons).toHaveLength(3); });
  it("allows a fully reviewed packet", () => expect(canApprovePacket({ status: "IN_REVIEW", fields: [{ isRequired: true, reviewStatus: "APPROVED" }], unresolvedConflicts: 0, requirements: [{ id: "r1", name: "Identification", isRequired: true, state: "SATISFIED", overridden: false }] }).allowed).toBe(true));
  it("requires a targeted override for each unsatisfied requirement", () => { const input = { status: "IN_REVIEW", fields: [{ isRequired: true, reviewStatus: "APPROVED" }], unresolvedConflicts: 0, requirements: [{ id: "r1", name: "Identification", isRequired: true, state: "MISSING", overridden: true }, { id: "r2", name: "Income", isRequired: true, state: "MISSING", overridden: false }] }; const result = canApprovePacket(input); expect(result.allowed).toBe(false); expect(result.reasons.join(" ")).toContain("Income"); });
});

describe("packet lifecycle", () => {
  it("permits only explicit forward transitions", () => { expect(canTransitionPacket("DRAFT", "READY_FOR_REVIEW")).toBe(true); expect(canTransitionPacket("READY_FOR_REVIEW", "IN_REVIEW")).toBe(true); expect(canTransitionPacket("IN_REVIEW", "APPROVED")).toBe(true); expect(canTransitionPacket("APPROVED", "IN_REVIEW")).toBe(false); expect(canTransitionPacket("NEEDS_CORRECTION", "APPROVED")).toBe(false); });
});
