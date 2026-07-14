import { describe, expect, it } from "vitest";
import { calculateDraftReadiness, mapTemplateFields, preserveStaffOverride, type CanonicalApplicationData, type TemplateFieldConfig } from "@/lib/applications/mapping";

describe("application draft workflow integration", () => {
  it("maps a draft, preserves a staff answer, resolves a conflict, and reaches generation readiness", () => {
    const fields: TemplateFieldConfig[] = [
      { id: "name", fieldKey: "name", displayLabel: "Name", fieldType: "TEXT", required: true, canonicalFieldPath: "client.name", validationRules: null, conditionalRules: null, formattingRules: null },
      { id: "address", fieldKey: "address", displayLabel: "Address", fieldType: "TEXT", required: true, canonicalFieldPath: "client.address", validationRules: null, conditionalRules: null, formattingRules: null },
      { id: "dob", fieldKey: "dob", displayLabel: "DOB", fieldType: "DATE", required: true, canonicalFieldPath: "client.dob", validationRules: null, conditionalRules: null, formattingRules: "DATE_US" },
    ];
    const canonical: CanonicalApplicationData = { values: { "client.name": { value: "Jordan Rivera", sourceType: "DOCUMENT", sourceReference: "State ID" }, "client.address": { value: null, sourceType: "CANONICAL_PROFILE", sourceReference: "Profile" }, "client.dob": { value: "1990-05-08", sourceType: "DOCUMENT", sourceReference: "State ID" } }, household: [], conflicts: { "client.dob": { values: ["1990-05-08", "1990-05-09"], sourceReference: "State ID and benefits letter" } } };
    const initial = mapTemplateFields(fields, canonical); expect(calculateDraftReadiness(initial.map((item, index) => ({ ...item, required: fields[index].required })))).toMatchObject({ ready: false, blockingCount: 2 });
    const staffAddress = { ...initial[1], finalValue: "100 Main Street", populationMethod: "STAFF_ENTRY", reviewState: "CONFIRMED", validationState: "VALID" };
    expect(preserveStaffOverride(staffAddress, mapTemplateFields(fields, { ...canonical, values: { ...canonical.values, "client.address": { value: "New canonical address", sourceType: "CANONICAL_PROFILE", sourceReference: "Profile" } } })[1])).toBe(true);
    const resolved = [initial[0], staffAddress, { ...initial[2], finalValue: "05/08/1990", populationMethod: "STAFF_ENTRY", reviewState: "CONFIRMED", validationState: "VALID" }];
    expect(calculateDraftReadiness(resolved.map((item, index) => ({ ...item, required: fields[index].required })))).toMatchObject({ ready: true, blockingCount: 0 });
  });
});
