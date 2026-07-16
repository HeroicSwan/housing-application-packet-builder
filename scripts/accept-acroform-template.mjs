import fs from "node:fs/promises";
import { PDFDocument, PDFCheckBox, PDFTextField } from "pdf-lib";

const [pdfPath, mappingPath] = process.argv.slice(2);
if (!pdfPath || !mappingPath) throw new Error("Usage: npm run templates:accept -- <agency.pdf> <acceptance-mapping.json>");
const mapping = JSON.parse(await fs.readFile(mappingPath, "utf8"));
if (!Array.isArray(mapping.fields) || mapping.fields.length === 0) throw new Error("Acceptance mapping must contain fields.");
const source = await fs.readFile(pdfPath);
const pdf = await PDFDocument.load(source, { ignoreEncryption: false, updateMetadata: false });
const form = pdf.getForm();
const available = new Set(form.getFields().map((field) => field.getName()));
const missing = mapping.fields.filter((field) => !available.has(field.pdfFieldName)).map((field) => field.pdfFieldName);
if (missing.length) throw new Error(`Mapped fields are missing from the PDF: ${missing.join(", ")}`);
for (const field of mapping.fields) {
  if (field.type === "text") form.getTextField(field.pdfFieldName).setText(String(field.testValue));
  else if (field.type === "checkbox") {
    const checkbox = form.getCheckBox(field.pdfFieldName);
    if (field.testValue) checkbox.check();
    else checkbox.uncheck();
  }
  else throw new Error(`Unsupported acceptance field type: ${field.type}`);
}
const roundTrip = (await PDFDocument.load(await pdf.save())).getForm();
for (const field of mapping.fields) {
  const loaded = roundTrip.getField(field.pdfFieldName);
  if (field.type === "text" && (!(loaded instanceof PDFTextField) || loaded.getText() !== String(field.testValue))) throw new Error(`Text round trip failed for ${field.pdfFieldName}.`);
  if (field.type === "checkbox" && (!(loaded instanceof PDFCheckBox) || loaded.isChecked() !== Boolean(field.testValue))) throw new Error(`Checkbox round trip failed for ${field.pdfFieldName}.`);
}
console.log(JSON.stringify({ accepted: true, templateName: mapping.templateName, pages: pdf.getPageCount(), discoveredFields: available.size, mappedFields: mapping.fields.length, roundTripFields: mapping.fields.length, sourceBytes: source.length }));
