import { PDFDocument, PDFName } from "pdf-lib";
import { inflateSync } from "node:zlib";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { preprocessImage } from "./preprocess";

const execFileAsync = promisify(execFile);
const maxPages = 10;
const maxExtractedTextCharacters = 250_000;

function rendererPath() {
  if (process.platform !== "win32") return "pdftoppm";
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const candidates = pathEntries.flatMap((directory) => [
    path.join(directory, "pdftoppm.exe"),
    path.resolve(directory, "..", "..", "native", "poppler", "Library", "bin", "pdftoppm.exe"),
  ]);
  return candidates.find((candidate) => existsSync(candidate)) ?? "pdftoppm.exe";
}

export async function renderPdfToPngDataUrls(bytes: Uint8Array, filename: string) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "hapb-pdf-render-"));
  const pdfPath = path.join(tempDirectory, "input.pdf");
  const outputPrefix = path.join(tempDirectory, "page");
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    const pageCount = pdf.getPageCount();
    if (pageCount < 1 || pageCount > maxPages) throw new Error(`Local PDF vision processing supports 1-${maxPages} pages per document.`);
    await writeFile(pdfPath, bytes);
    await execFileAsync(rendererPath(), ["-png", "-r", "144", "-f", "1", "-l", String(pageCount), pdfPath, outputPrefix], { windowsHide: true, maxBuffer: 1024 * 1024 });
    const renderedFiles = (await readdir(tempDirectory)).filter((file) => /^page-\d+\.png$/i.test(file)).sort((left, right) => Number(left.match(/\d+/)?.[0] ?? 0) - Number(right.match(/\d+/)?.[0] ?? 0));
    if (renderedFiles.length !== pageCount) throw new Error(`Local PDF renderer returned ${renderedFiles.length} page image(s) for ${filename}; expected ${pageCount}.`);
    const pages = await Promise.all(renderedFiles.map(async (file) => preprocessImage(await readFile(path.join(tempDirectory, file)))));
    return pages.map((page) => page.dataUrl);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

function decodePdfText(value: string) {
  const hex = value.match(/^<([0-9a-f]+)>$/i)?.[1];
  if (hex) return Buffer.from(hex.length % 2 === 0 ? hex : `${hex}0`, "hex").toString("utf8");
  return value.slice(1, -1).replace(/\\([\\()])/g, "$1");
}

export async function extractPdfText(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  const pageCount = pdf.getPageCount();
  if (pageCount < 1 || pageCount > maxPages) throw new Error(`Local PDF text extraction supports 1-${maxPages} pages per document.`);
  const text = pdf.getPages().map((page, pageIndex) => {
    const contents = page.node.get(PDFName.of("Contents")) as { asArray?: () => unknown[] } | undefined;
    const refs = contents?.asArray?.() ?? (contents ? [contents] : []);
    const text = refs.map((ref) => {
      const stream = pdf.context.lookup(ref as never) as { contents?: Uint8Array } | undefined;
      if (!stream?.contents) return "";
      let source = Buffer.from(stream.contents);
      try { source = inflateSync(source); } catch { /* uncompressed stream */ }
      return source.toString("latin1").replace(/<([0-9a-f]+)>\s*Tj|\((?:\\.|[^)])*\)\s*Tj/gi, (match) => decodePdfText(match.replace(/\s*Tj$/i, "").trim()));
    }).join("\n");
    return `Page ${pageIndex + 1}: ${text.replace(/\s+/g, " ").trim()}`;
  }).filter(Boolean).join("\n");
  return text.slice(0, maxExtractedTextCharacters);
}
