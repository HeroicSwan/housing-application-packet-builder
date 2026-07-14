import path from "node:path";

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
