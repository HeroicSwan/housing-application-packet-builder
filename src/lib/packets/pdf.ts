import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PacketPdfData = {
  referenceNumber: string; version: number; generatedAt: Date; clientName: string; clientSummary: string[]; household: string[]; programName: string;
  requirements: { name: string; state: string; reason: string }[]; fields: { label: string; value: string; source: string }[]; documents: string[]; missingInformation: string[]; notes: string[];
};

export async function generatePacketPdf(data: PacketPdfData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]); let y = 744;
  const addPage = () => { page = pdf.addPage([612, 792]); y = 744; };
  const line = (text: string, size = 10, isBold = false, indent = 0) => {
    const safe = text.replace(/[^\x20-\x7E]/g, "-");
    const maxCharacters = Math.max(30, Math.floor((516 - indent) / (size * 0.52)));
    const words = safe.split(/\s+/); const rows: string[] = []; let row = "";
    for (const word of words) { if (!row || `${row} ${word}`.length <= maxCharacters) row = row ? `${row} ${word}` : word; else { rows.push(row); row = word; } }
    if (row) rows.push(row);
    for (const current of rows.length ? rows : [""]) { if (y < 55) addPage(); page.drawText(current, { x: 48 + indent, y, size, font: isBold ? bold : regular, color: rgb(0.07, 0.07, 0.07) }); y -= size + 7; }
  };
  line("INTERNAL APPLICATION REVIEW SUMMARY", 18, true); line(`${data.referenceNumber} - Version ${data.version}`, 11, true); y -= 8;
  line("HUMAN REVIEW REQUIRED BEFORE SUBMISSION", 10, true); line("This support tool does not determine eligibility or make legal conclusions.", 9); y -= 12;
  line("Client and household", 13, true); line(`Primary client: ${data.clientName}`); data.clientSummary.forEach((item) => line(item, 10, false, 10)); (data.household.length ? data.household : ["No additional household members recorded."]).forEach((member) => line(`Household member: ${member}`, 10, false, 10)); y -= 8;
  line("Selected program", 13, true); line(data.programName); y -= 8;
  line("Reviewed case fields", 13, true); data.fields.forEach((field) => { line(`${field.label}: ${field.value}`, 10, true); line(`Source: ${field.source}`, 8, false, 10); }); y -= 8;
  line("Requirement checklist", 13, true); data.requirements.forEach((requirement) => { line(`${requirement.state}  ${requirement.name}`, 10, true); line(requirement.reason, 8, false, 10); }); y -= 8;
  line("Supporting documents", 13, true); (data.documents.length ? data.documents : ["No documents listed"]).forEach((document) => line(document)); y -= 8;
  line("Missing information", 13, true); (data.missingInformation.length ? data.missingInformation : ["No missing mandatory information recorded in this snapshot."]).forEach((item) => line(item)); y -= 8;
  line("Review notes", 13, true); (data.notes.length ? data.notes : ["No review notes"]).forEach((note) => line(note));
  const pages = pdf.getPages(); pages.forEach((currentPage, index) => currentPage.drawText(`Page ${index + 1} of ${pages.length}  |  Generated ${data.generatedAt.toISOString().slice(0, 10)}`, { x: 48, y: 28, size: 8, font: regular, color: rgb(0.36, 0.36, 0.38) }));
  return pdf.save();
}
