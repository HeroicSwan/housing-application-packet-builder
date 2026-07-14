import { describe, expect, it } from "vitest";
import { evaluateRequirement } from "@/lib/requirements/engine";

const requirement = { id: "r1", name: "Government-issued identification", category: "IDENTITY", isRequired: true };

describe("requirement-state calculation", () => {
  it("marks missing evidence transparently", () => expect(evaluateRequirement(requirement, [])).toEqual({ state: "MISSING", reason: "No government-issued identification has been added." }));
  it("marks expired evidence", () => expect(evaluateRequirement(requirement, [{ category: "IDENTITY", expirationDate: new Date("2025-01-01"), reviewStatuses: ["APPROVED"] }], [], undefined, new Date("2026-01-01")).state).toBe("EXPIRED"));
  it("requires review for pending extraction", () => expect(evaluateRequirement(requirement, [{ category: "IDENTITY", expirationDate: new Date("2028-01-01"), reviewStatuses: ["PENDING"] }]).state).toBe("NEEDS_REVIEW"));
  it("marks reviewed current evidence satisfied", () => expect(evaluateRequirement(requirement, [{ category: "IDENTITY", expirationDate: new Date("2028-01-01"), reviewStatuses: ["APPROVED"] }]).state).toBe("SATISFIED"));
  it("surfaces a related conflict before acceptance", () => expect(evaluateRequirement(requirement, [], ["IDENTITY"]).state).toBe("CONFLICT"));
  it("keeps an expiration date valid through the end of that day", () => expect(evaluateRequirement(requirement, [{ category: "IDENTITY", expirationDate: new Date("2026-07-12T00:00:00"), reviewStatuses: ["APPROVED"] }], [], undefined, new Date("2026-07-12T18:00:00")).state).toBe("SATISFIED"));
  it("gives conflicts precedence over expiration", () => expect(evaluateRequirement(requirement, [{ category: "IDENTITY", expirationDate: new Date("2020-01-01"), reviewStatuses: ["APPROVED"] }], ["IDENTITY"], undefined, new Date("2026-01-01")).state).toBe("CONFLICT"));
  it("does not treat failed processing as missing", () => expect(evaluateRequirement(requirement, [{ category: "IDENTITY", processingStatus: "FAILED", reviewStatuses: [] }]).state).toBe("NEEDS_REVIEW"));
  it("uses the reviewed required field rather than an unrelated rejected field", () => expect(evaluateRequirement({ ...requirement, requiredFieldName: "legal_name" }, [{ category: "IDENTITY", processingStatus: "COMPLETED", reviewStatuses: ["EDITED", "REJECTED"], extractedFields: [{ fieldName: "legal_name", extractedValue: "Jordan Lee", reviewedValue: "Jordan Lee", reviewStatus: "EDITED" }, { fieldName: "document_number", extractedValue: "bad", reviewStatus: "REJECTED" }] }]).state).toBe("SATISFIED"));
});
