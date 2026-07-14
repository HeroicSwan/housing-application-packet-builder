import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";

export async function inspectAcroForm(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const fields = pdf.getForm().getFields().map((field, index) => ({
    name: field.getName(),
    type: field instanceof PDFTextField ? "TEXT" : field instanceof PDFCheckBox ? "BOOLEAN" : field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList ? "SELECT" : "UNSUPPORTED",
    displayOrder: index + 1,
  }));
  if (!fields.length) throw new Error("This PDF does not contain AcroForm fields.");
  if (fields.some((field) => field.type === "UNSUPPORTED")) throw new Error("This PDF contains an unsupported AcroForm field type.");
  return { pageCount: pdf.getPageCount(), fields };
}
