import { describe, expect, it } from "vitest";
import { detectInconsistencies, namesEquivalent, normalizeDate, parseCurrency } from "@/lib/requirements/inconsistencies";

describe("inconsistency detection", () => {
  it("reports name, date, household, signature, and blank-field review items", () => {
    const items = detectInconsistencies({ legalName: "Jordan Lee", dateOfBirth: new Date("1988-06-14T12:00:00Z"), householdCount: 2, requiredFields: { phone: "" } }, [
      { fieldName: "legal_name", value: "Morgan Lee", category: "IDENTITY" },
      { fieldName: "date_of_birth", value: "1989-06-14", category: "IDENTITY" },
      { fieldName: "household_count", value: "3", category: "HOUSEHOLD" },
      { fieldName: "signature_present", value: "false", category: "OTHER" },
    ]);
    expect(items.map((item) => item.code)).toEqual(expect.arrayContaining(["LEGAL_NAME_CONFLICT", "DOB_CONFLICT", "HOUSEHOLD_COUNT_CONFLICT", "MISSING_SIGNATURE", "MISSING_PHONE"]));
  });
  it("ignores harmless name punctuation and middle initials", () => { expect(namesEquivalent("Jordan A. Lee", "  JORDAN Lee ")).toBe(true); expect(namesEquivalent("Jordan Lee", "Morgan Lee")).toBe(false); });
  it("normalizes common date and currency formats", () => { expect(normalizeDate("06/14/1988")).toBe("1988-06-14"); expect(parseCurrency("$1,850.00")).toBe(1850); });
  it("reports meaningfully different income and expired identity evidence", () => { const items = detectInconsistencies({ legalName: "Jordan Lee", householdCount: 1, documents: [{ category: "IDENTITY", expirationDate: new Date("2024-01-01") }] }, [{ fieldName: "gross_monthly_income", value: "$1,000", category: "INCOME" }, { fieldName: "gross_monthly_income", value: "1,500.00", category: "INCOME" }], new Date("2026-01-01")); expect(items.map((item) => item.code)).toEqual(expect.arrayContaining(["INCOME_CONFLICT", "EXPIRED_IDENTITY"])); });
});
