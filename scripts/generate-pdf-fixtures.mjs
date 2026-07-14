import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const fixtures = [
  ["jordan-state-identification.pdf", "FICTIONAL STATE IDENTIFICATION", ["Name: Jordan Rivera", "Date of birth: 05/08/1990", "Document type: State identification card", "Expiration date: 04/30/2025", "Synthetic fixture - not a real identity document"]],
  ["jordan-income-statement.pdf", "FICTIONAL INCOME STATEMENT", ["Employee: Jordan Rivera", "Gross monthly income: $1,450.00", "Statement period: June 2026", "Synthetic fixture - not employment evidence"]],
  ["jordan-benefits-award.pdf", "FICTIONAL BENEFITS AWARD LETTER", ["Recipient: Jordan Rivera", "Date of birth recorded: 05/09/1990", "Monthly benefits income: $620.00", "Programs: SNAP and Medicaid", "Synthetic fixture - not an agency notice"]],
  ["jordan-homelessness-verification.pdf", "FICTIONAL HOMELESSNESS VERIFICATION", ["Applicant: Jordan Rivera", "Verified on: June 25, 2026", "Current situation: Staying temporarily with family", "Synthetic fixture - not a service-provider record"]],
];

await mkdir("fixtures", { recursive: true });
for (const [filename, title, rows] of fixtures) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([612, 792]); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 708, width: 612, height: 84, color: rgb(0.14, 0.29, 0.42) });
  page.drawText(title, { x: 48, y: 748, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Family Pathways demonstration fixture", { x: 48, y: 728, size: 9, font: regular, color: rgb(0.85, 0.92, 0.96) });
  rows.forEach((row, index) => { page.drawText(row, { x: 54, y: 650 - index * 46, size: index === rows.length - 1 ? 9 : 12, font: index === rows.length - 1 ? bold : regular, color: index === rows.length - 1 ? rgb(0.65, 0.25, 0.2) : rgb(0.1, 0.13, 0.17) }); page.drawLine({ start: { x: 54, y: 636 - index * 46 }, end: { x: 558, y: 636 - index * 46 }, thickness: 0.5, color: rgb(0.84, 0.86, 0.88) }); });
  page.drawText("Page 1 of 1", { x: 500, y: 30, size: 8, font: regular, color: rgb(0.4, 0.44, 0.48) });
  await writeFile(`fixtures/${filename}`, await pdf.save());
}

const agency = await PDFDocument.create(); const agencyPage = agency.addPage([612, 792]); const agencyRegular = await agency.embedFont(StandardFonts.Helvetica); const agencyBold = await agency.embedFont(StandardFonts.HelveticaBold); agencyPage.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) }); agencyPage.drawRectangle({ x: 0, y: 708, width: 612, height: 84, color: rgb(0.14, 0.29, 0.42) }); agencyPage.drawText("FAMILY PATHWAYS AGENCY APPLICATION", { x: 48, y: 748, size: 18, font: agencyBold, color: rgb(1, 1, 1) }); agencyPage.drawText("Synthetic fillable AcroForm for configuration and QA", { x: 48, y: 728, size: 9, font: agencyRegular, color: rgb(0.85, 0.92, 0.96) });
const agencyForm = agency.getForm(); const agencyFields = [["Applicant.Name", "Applicant legal name", 650], ["Applicant.DOB", "Date of birth", 590], ["Applicant.Phone", "Phone", 530], ["Applicant.Email", "Email", 470], ["Household.Size", "Household size", 410], ["Income.Monthly", "Total monthly income", 350], ["Signature.Typed", "Electronic signature", 230]]; for (const [name, label, y] of agencyFields) { agencyPage.drawText(label, { x: 54, y: y + 24, size: 9, font: agencyBold, color: rgb(0.25, 0.3, 0.35) }); const field = agencyForm.createTextField(name); field.addToPage(agencyPage, { x: 54, y, width: 500, height: 22, borderWidth: 1 }); } agencyPage.drawText("Applicant consent confirmed", { x: 82, y: 292, size: 10, font: agencyRegular, color: rgb(0.1, 0.13, 0.17) }); agencyForm.createCheckBox("Consent.Yes").addToPage(agencyPage, { x: 54, y: 286, width: 18, height: 18, borderWidth: 1 });
await writeFile("fixtures/family-pathways-agency-acroform.pdf", await agency.save());
