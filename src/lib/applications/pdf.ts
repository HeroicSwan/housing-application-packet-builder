import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type CompletedApplicationField = { key: string; label: string; type: string; required: boolean; value: string | null; section: string; pageNumber: number };
export type CompletedApplicationData = { programName: string; applicationName: string; templateVersion: number; applicationReference: string; generationVersion: number; generatedAt: Date; signature?: { signedName: string; signedAt: Date; method: string } | null; fields: CompletedApplicationField[] };

const pageSize: [number, number] = [612, 792];
const ink = rgb(0.09, 0.13, 0.17);
const muted = rgb(0.38, 0.44, 0.49);
const blue = rgb(0.14, 0.29, 0.42);
const rule = rgb(0.84, 0.86, 0.88);
const pale = rgb(0.95, 0.97, 0.98);

function clean(value: string) { return value.replace(/[^\x20-\x7E]/g, "-"); }

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = clean(text).split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(next, size) <= width) line = next; else { if (line) lines.push(line); line = word; } }
  if (line) lines.push(line); return lines.length ? lines : [""];
}

export async function generateCompletedApplicationPdf(data: CompletedApplicationData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const grouped = new Map<string, CompletedApplicationField[]>();
  for (const field of data.fields) (grouped.get(field.section) ?? (grouped.set(field.section, []), grouped.get(field.section)!)).push(field);
  let page: PDFPage = pdf.addPage(pageSize); let y = 708;
  const drawHeader = () => { page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) }); page.drawRectangle({ x: 0, y: 744, width: 612, height: 48, color: blue }); page.drawText(clean(data.applicationName), { x: 42, y: 766, size: 14, font: bold, color: rgb(1, 1, 1) }); page.drawText(clean(data.programName), { x: 42, y: 752, size: 8, font: regular, color: rgb(0.88, 0.93, 0.96) }); };
  const newPage = () => { page = pdf.addPage(pageSize); y = 708; drawHeader(); };
  const ensure = (height: number) => { if (y - height < 55) newPage(); };
  const section = (title: string) => { ensure(34); y -= 8; page.drawRectangle({ x: 42, y: y - 15, width: 528, height: 25, color: pale }); page.drawText(clean(title), { x: 50, y: y - 7, size: 11, font: bold, color: blue }); y -= 28; };
  const textField = (field: CompletedApplicationField) => {
    const value = field.value || (field.required ? "Information required" : "Not provided"); const lines = wrap(value, regular, 10, 244); const height = 32 + Math.max(0, lines.length - 1) * 13; ensure(height);
    page.drawText(clean(field.label), { x: 50, y, size: 8, font: bold, color: muted });
    lines.forEach((line, index) => page.drawText(line, { x: 50, y: y - 15 - index * 13, size: 10, font: regular, color: field.value ? ink : rgb(0.65, 0.25, 0.2) }));
    page.drawLine({ start: { x: 50, y: y - 20 - (lines.length - 1) * 13 }, end: { x: 306, y: y - 20 - (lines.length - 1) * 13 }, thickness: 0.6, color: rule }); y -= height;
  };
  const householdTable = (field: CompletedApplicationField) => {
    ensure(80); const rows = field.value ? JSON.parse(field.value) as { name: string; relationship: string; dateOfBirth: string | null; monthlyIncomeCents: number | null }[] : [];
    page.drawRectangle({ x: 50, y: y - 20, width: 512, height: 20, color: pale });
    [["Name", 54], ["Relationship", 260], ["Date of birth", 370], ["Monthly income", 468]].forEach(([label, x]) => page.drawText(String(label), { x: Number(x), y: y - 14, size: 8, font: bold, color: muted })); y -= 24;
    if (!rows.length) { page.drawText("No additional household members listed.", { x: 54, y: y - 12, size: 9, font: regular, color: muted }); y -= 26; return; }
    for (const row of rows) { ensure(24); page.drawText(clean(row.name), { x: 54, y: y - 12, size: 9, font: regular, color: ink }); page.drawText(clean(row.relationship), { x: 260, y: y - 12, size: 9, font: regular, color: ink }); page.drawText(row.dateOfBirth ?? "", { x: 370, y: y - 12, size: 9, font: regular, color: ink }); page.drawText(row.monthlyIncomeCents === null ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(row.monthlyIncomeCents / 100), { x: 468, y: y - 12, size: 9, font: regular, color: ink }); page.drawLine({ start: { x: 50, y: y - 18 }, end: { x: 562, y: y - 18 }, thickness: 0.5, color: rule }); y -= 22; }
  };
  drawHeader();
  page.drawText(`Application reference: ${clean(data.applicationReference)}`, { x: 42, y: 728, size: 9, font: bold, color: muted });
  for (const [title, fields] of grouped) { section(title); for (const field of fields) { if (field.type === "SIGNATURE_PLACEHOLDER" || field.type === "SIGNATURE") continue; if (field.type === "HOUSEHOLD_TABLE") householdTable(field); else textField(field); } }
  section("Applicant signature"); ensure(90); page.drawText("I certify that the information in this application is complete and accurate to the best of my knowledge.", { x: 50, y, size: 9, font: regular, color: ink }); y -= 38; if (data.signature) { page.drawText(clean(`/s/ ${data.signature.signedName}`), { x: 50, y: y + 5, size: 11, font: regular, color: ink }); page.drawText(data.signature.signedAt.toISOString().slice(0, 10), { x: 405, y: y + 5, size: 10, font: regular, color: ink }); } page.drawLine({ start: { x: 50, y }, end: { x: 350, y }, thickness: 0.8, color: ink }); page.drawText(data.signature ? "Electronically signed" : "Applicant signature", { x: 50, y: y - 13, size: 8, font: regular, color: muted }); page.drawLine({ start: { x: 405, y }, end: { x: 562, y }, thickness: 0.8, color: ink }); page.drawText("Date", { x: 405, y: y - 13, size: 8, font: regular, color: muted });
  const pages = pdf.getPages(); pages.forEach((current, index) => { current.drawLine({ start: { x: 42, y: 40 }, end: { x: 570, y: 40 }, thickness: 0.5, color: rule }); current.drawText(`Family Pathways Housing Application v${data.templateVersion}`, { x: 42, y: 25, size: 8, font: regular, color: muted }); current.drawText(`Page ${index + 1} of ${pages.length}`, { x: 510, y: 25, size: 8, font: regular, color: muted }); });
  return pdf.save();
}

export async function generateSupportingPacketPdf(input: { applicationBytes: Uint8Array; applicationReference: string; applicantName: string; documents: { name: string; category: string; bytes?: Uint8Array }[]; missingDocuments: string[] }) {
  const output = await PDFDocument.create(); const regular = await output.embedFont(StandardFonts.Helvetica); const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const cover = output.addPage(pageSize); cover.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: blue }); cover.drawText("SUPPORTING APPLICATION PACKET", { x: 46, y: 748, size: 20, font: bold, color: rgb(1, 1, 1) }); cover.drawText(clean(input.applicationReference), { x: 46, y: 722, size: 11, font: regular, color: rgb(0.88, 0.93, 0.96) }); cover.drawText(clean(input.applicantName), { x: 46, y: 650, size: 22, font: bold, color: ink }); cover.drawText("Document index", { x: 46, y: 600, size: 13, font: bold, color: blue }); let y = 574;
  ["Completed Family Pathways Housing Application", ...input.documents.map((document) => `${document.name} - ${document.category.replaceAll("_", " ")}`)].forEach((item, index) => { cover.drawText(`${index + 1}. ${clean(item)}`, { x: 54, y, size: 10, font: regular, color: ink }); y -= 22; });
  if (input.missingDocuments.length) { y -= 14; cover.drawText("Missing-document checklist", { x: 46, y, size: 12, font: bold, color: rgb(0.65, 0.25, 0.2) }); y -= 24; input.missingDocuments.forEach((item) => { cover.drawText(`- ${clean(item)}`, { x: 54, y, size: 9, font: regular, color: ink }); y -= 18; }); }
  const application = await PDFDocument.load(input.applicationBytes); const applicationPages = await output.copyPages(application, application.getPageIndices()); applicationPages.forEach((item) => output.addPage(item));
  for (const document of input.documents) if (document.bytes) { try { const source = await PDFDocument.load(document.bytes); const pages = await output.copyPages(source, source.getPageIndices()); pages.forEach((item) => output.addPage(item)); } catch {} }
  return output.save();
}
