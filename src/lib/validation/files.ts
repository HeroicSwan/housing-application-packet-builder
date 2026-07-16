import path from "node:path";
import { PDFDocument } from "pdf-lib";

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

export function sanitizeFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path.basename(filename, path.extname(filename)).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";
  return `${base}${extension}`;
}

export function validateUpload(file: Pick<File, "name" | "type" | "size">, maxMb = 8) {
  if (!allowedTypes.has(file.type)) return { valid: false, error: "Upload a PDF, PNG, or JPEG file." };
  if (file.size > maxMb * 1024 * 1024) return { valid: false, error: `File must be ${maxMb} MB or smaller.` };
  const extension = path.extname(file.name).toLowerCase();
  const expected = file.type === "application/pdf" ? [".pdf"] : file.type === "image/png" ? [".png"] : [".jpg", ".jpeg"];
  if (!expected.includes(extension)) return { valid: false, error: "The file extension does not match its content type." };
  return { valid: true as const };
}

export function validateFileSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return false;
}

function imageDimensions(bytes: Uint8Array, mimeType: string) {
  const buffer = Buffer.from(bytes);
  if (mimeType === "image/png" && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      if (length < 2) break;
      offset += length + 2;
    }
  }
  throw new Error("Image dimensions could not be validated.");
}

export async function inspectDocumentSafety(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") {
    const source = Buffer.from(bytes).toString("latin1");
    const normalizedSource = source.replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
    const objectCount = (source.match(/\b\d+\s+\d+\s+obj\b/g) ?? []).length;
    const streamCount = (source.match(/\bstream\b/g) ?? []).length;
    if (objectCount > 20_000 || streamCount > 10_000) throw new Error("PDF structure exceeds the safe processing limit.");
    const activeTokens = [/\/JavaScript\b/i, /\/JS\b/i, /\/OpenAction\b/i, /\/AA\b/i, /\/Launch\b/i, /\/EmbeddedFile\b/i, /\/RichMedia\b/i, /\/XFA\b/i, /\/SubmitForm\b/i, /\/ImportData\b/i];
    if (activeTokens.some((token) => token.test(source) || token.test(normalizedSource))) throw new Error("PDF active content and embedded files are not allowed.");
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    if (pdf.getPageCount() < 1 || pdf.getPageCount() > 100) throw new Error("PDF documents must contain between 1 and 100 pages.");
    return;
  }
  const { width, height } = imageDimensions(bytes, mimeType);
  if (width < 1 || height < 1 || width > 20_000 || height > 20_000 || width * height > 40_000_000) throw new Error("Image dimensions exceed the safe processing limit.");
}
