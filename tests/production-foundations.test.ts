import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { inspectAcroForm } from "@/lib/applications/acroform";
import { normalizeMonthlyIncome } from "@/lib/applications/income";
import { decryptBytes, encryptBytes } from "@/lib/security/encryption";

describe("production foundations", () => {
  it("encrypts stored bytes with authenticated encryption", () => {
    const plain = Buffer.from("sensitive housing document"); const encrypted = encryptBytes(plain);
    expect(encrypted.equals(plain)).toBe(false); expect(Buffer.from(decryptBytes(encrypted)).toString()).toBe(plain.toString());
    encrypted[encrypted.length - 1] ^= 1; expect(() => decryptBytes(encrypted)).toThrow();
  });

  it("discovers text and checkbox fields in an agency AcroForm", async () => {
    const pdf = await PDFDocument.create(); const page = pdf.addPage(); const form = pdf.getForm(); form.createTextField("Applicant.Name").addToPage(page); form.createCheckBox("Consent.Yes").addToPage(page);
    const result = await inspectAcroForm(await pdf.save());
    expect(result.fields).toEqual(expect.arrayContaining([{ name: "Applicant.Name", type: "TEXT", displayOrder: 1 }, { name: "Consent.Yes", type: "BOOLEAN", displayOrder: 2 }]));
  });

  it("normalizes unusual pay periods into monthly amounts", () => {
    const base = { hoursPerWeek: null, weeksPerYear: null, startDate: null, endDate: null };
    expect(normalizeMonthlyIncome({ ...base, amountCents: 50000, frequency: "WEEKLY" })).toBeCloseTo(216666.67, 1);
    expect(normalizeMonthlyIncome({ ...base, amountCents: 2000, frequency: "HOURLY", hoursPerWeek: 30, weeksPerYear: 48 })).toBe(240000);
    expect(normalizeMonthlyIncome({ ...base, amountCents: 120000, frequency: "ONE_TIME", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31") })).toBe(40000);
  });
});
