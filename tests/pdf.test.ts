import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePacketPdf } from "@/lib/packets/pdf";

describe("PDF generation", () => {
  it("creates a readable multi-section packet", async () => { const bytes = await generatePacketPdf({ referenceNumber: "PKT-TEST-V1", version: 1, generatedAt: new Date("2026-07-12"), clientName: "Synthetic Client", clientSummary: ["Current living situation: Temporary shelter"], household: ["Synthetic Child (Child)"], programName: "Fictional Housing Program", requirements: [{ name: "Identification", state: "SATISFIED", reason: "Reviewed identity document is present." }], fields: [{ label: "Legal name", value: "Synthetic Client", source: "Case record" }], documents: ["sample-id.pdf"], missingInformation: [], notes: ["Human review completed."] }); const pdf = await PDFDocument.load(bytes); expect(bytes.byteLength).toBeGreaterThan(1000); expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1); });
});
