import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, StandardFonts } from "pdf-lib";

type FillableValue = { pdfFieldName: string; value: string; fieldType: string; formattingRules?: string | null };

function formattedValue(item: FillableValue) {
  if (item.fieldType === "DATE" || item.formattingRules === "DATE_US") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.value);
    if (!match) throw new Error(`PDF field "${item.pdfFieldName}" requires an ISO date (YYYY-MM-DD).`);
    return `${match[2]}/${match[3]}/${match[1]}`;
  }
  if (item.fieldType === "CURRENCY" || item.formattingRules === "CURRENCY_USD") {
    const amount = Number(item.value.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount)) throw new Error(`PDF field "${item.pdfFieldName}" requires a valid currency amount.`);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
  return item.value;
}

export async function populateFillablePdf(templateBytes: Uint8Array, values: FillableValue[], flatten = false) {
  const pdf = await PDFDocument.load(templateBytes, { ignoreEncryption: false, updateMetadata: false });
  const originalPageCount = pdf.getPageCount();
  const form = pdf.getForm();
  const available = new Set(form.getFields().map((field) => field.getName()));
  for (const item of values) {
    if (!available.has(item.pdfFieldName)) throw new Error(`Configured PDF field "${item.pdfFieldName}" does not exist in the template.`);
    const field = form.getField(item.pdfFieldName);
    const value = formattedValue(item);
    if (field instanceof PDFTextField) {
      const maxLength = field.getMaxLength();
      if (maxLength !== undefined && value.length > maxLength) throw new Error(`PDF field "${item.pdfFieldName}" exceeds its ${maxLength}-character limit.`);
      if (/\r|\n/.test(value) && !field.isMultiline()) field.enableMultiline();
      field.setText(value);
    } else if (field instanceof PDFCheckBox) {
      if (["yes", "true", "1", "on", "checked"].includes(value.trim().toLowerCase())) field.check();
      else field.uncheck();
    } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup || field instanceof PDFOptionList) {
      field.select(value);
    } else {
      throw new Error(`PDF field "${item.pdfFieldName}" uses an unsupported AcroForm type.`);
    }
  }
  try {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
  } catch {
    throw new Error("The agency PDF needs a supported embedded font for the mapped values.");
  }
  if (flatten) form.flatten();
  const bytes = await pdf.save({ useObjectStreams: false });
  const verified = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  if (verified.getPageCount() !== originalPageCount) throw new Error("The filled PDF did not preserve the original page count.");
  return bytes;
}
