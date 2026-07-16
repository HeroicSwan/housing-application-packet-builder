import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { inspectDocumentSafety } from "@/lib/validation/files";

describe("hostile document preflight", () => {
  it("accepts a bounded ordinary PDF", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage([612, 792]);
    await expect(inspectDocumentSafety(await pdf.save(), "application/pdf")).resolves.toBeUndefined();
  });

  it.each(["/JavaScript", "/OpenAction", "/EmbeddedFile", "/Launch", "/XFA"])("rejects active PDF token %s", async (token) => {
    const pdf = await PDFDocument.create(); pdf.addPage([612, 792]);
    const bytes = Buffer.concat([Buffer.from(await pdf.save()), Buffer.from(`\n% ${token}\n`)]);
    await expect(inspectDocumentSafety(bytes, "application/pdf")).rejects.toThrow("active content");
  });

  it("rejects hex-escaped active PDF names", async () => {
    const pdf = await PDFDocument.create(); pdf.addPage([612, 792]);
    const bytes = Buffer.concat([Buffer.from(await pdf.save()), Buffer.from("\n% /Open#41ction\n")]);
    await expect(inspectDocumentSafety(bytes, "application/pdf")).rejects.toThrow("active content");
  });

  it("rejects excessively complex PDF object graphs before parsing", async () => {
    const bytes = Buffer.from(`%PDF-1.7\n${Array.from({ length: 20_001 }, (_, index) => `${index} 0 obj\nendobj`).join("\n")}`);
    await expect(inspectDocumentSafety(bytes, "application/pdf")).rejects.toThrow("structure exceeds");
  });

  it("rejects a PNG decompression-bomb dimension claim", async () => {
    const png = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(100_000, 16); png.writeUInt32BE(100_000, 20);
    await expect(inspectDocumentSafety(png, "image/png")).rejects.toThrow("safe processing limit");
  });
});
