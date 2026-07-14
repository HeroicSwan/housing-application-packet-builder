import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";

export async function populateFillablePdf(templateBytes: Uint8Array, values: { pdfFieldName: string; value: string; fieldType: string }[], flatten = false) {
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();
  const available = new Set(form.getFields().map((field) => field.getName()));
  for (const item of values) {
    if (!available.has(item.pdfFieldName)) throw new Error(`Configured PDF field "${item.pdfFieldName}" does not exist in the template.`);
    const field = form.getField(item.pdfFieldName);
    if (field instanceof PDFTextField) field.setText(item.value);
    else if (field instanceof PDFCheckBox) { if (item.value === "Yes" || item.value === "true") field.check(); else field.uncheck(); }
    else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList) field.select(item.value);
    else throw new Error(`PDF field "${item.pdfFieldName}" uses an unsupported AcroForm type.`);
  }
  if (flatten) form.flatten();
  return pdf.save();
}
