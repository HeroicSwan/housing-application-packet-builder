import fs from "node:fs/promises";
import { generateCompletedApplicationPdf } from "@/lib/applications/pdf";
import { populateFillablePdf } from "@/lib/applications/fillable-pdf";
import { getCompletedApplicationData } from "@/lib/applications/service";
import { getObject } from "@/lib/storage";

export async function generateApplicationOutput(draftId: string) {
  const result = await getCompletedApplicationData(draftId);
  if (result.draft.template.templateType !== "ACROFORM") return { ...result, bytes: await generateCompletedApplicationPdf(result.pdfData) };
  const templateBytes = result.draft.template.sourceStorageKey ? await getObject(result.draft.template.sourceStorageKey) : result.draft.template.sourceFilePath ? new Uint8Array(await fs.readFile(result.draft.template.sourceFilePath)) : null;
  if (!templateBytes) throw new Error("The AcroForm source PDF is unavailable.");
  const values = result.draft.fields.filter((field) => field.templateField.pdfFieldName).map((field) => ({ pdfFieldName: field.templateField.pdfFieldName!, value: field.templateField.fieldType === "SIGNATURE" ? result.draft.signature?.signedName ?? "" : field.finalValue ?? "", fieldType: field.templateField.fieldType, formattingRules: field.templateField.formattingRules }));
  return { ...result, bytes: await populateFillablePdf(templateBytes, values, false) };
}
