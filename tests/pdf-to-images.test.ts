import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { extractPdfText, renderPdfToPngDataUrls } from "@/lib/document-processing/pdf-to-images";

describe("local PDF vision adapter", () => {
  it("renders a synthetic PDF into local PNG data URLs", async () => {
    const bytes = await readFile("fixtures/jordan-state-identification.pdf");
    const pages = await renderPdfToPngDataUrls(bytes, "jordan-state-identification.pdf");
    expect(pages.length).toBe(1);
    expect(pages[0].startsWith("data:image/png;base64,iVBOR")).toBe(true);
    expect(await extractPdfText(bytes)).toContain("Expiration date: 04/30/2025");
  }, 30_000);
});
