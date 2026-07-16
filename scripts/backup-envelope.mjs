import crypto from "node:crypto";

const magic = Buffer.from("HAPBBK2\n");

function decodeKey(value) {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw new Error("Backup encryption keys must be canonical Base64 for exactly 32 bytes.");
  return key;
}

function currentKey() {
  if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY is required for backup operations.");
  return decodeKey(process.env.DATA_ENCRYPTION_KEY);
}

function keyRing() {
  const ring = new Map([[process.env.DATA_ENCRYPTION_KEY_ID ?? "primary", currentKey()]]);
  if (process.env.DATA_ENCRYPTION_PREVIOUS_KEYS) for (const [id, value] of Object.entries(JSON.parse(process.env.DATA_ENCRYPTION_PREVIOUS_KEYS))) ring.set(id, decodeKey(value));
  return ring;
}

export function encryptBackup(plain, kind) {
  const checksum = crypto.createHash("sha256").update(plain).digest("hex");
  const header = Buffer.from(`${JSON.stringify({ kind, keyId: process.env.DATA_ENCRYPTION_KEY_ID ?? "primary", checksum, createdAt: new Date().toISOString() })}\n`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", currentKey(), iv);
  cipher.setAAD(header);
  return { bytes: Buffer.concat([magic, header, iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()]), checksum };
}

export function decryptBackup(input) {
  if (!Buffer.from(input).subarray(0, magic.length).equals(magic)) throw new Error("Backup envelope is invalid.");
  const headerEnd = Buffer.from(input).indexOf(10, magic.length);
  if (headerEnd < 0) throw new Error("Backup header is invalid.");
  const headerBytes = Buffer.from(input).subarray(magic.length, headerEnd + 1);
  const header = JSON.parse(headerBytes.toString());
  const key = keyRing().get(header.keyId);
  if (!key) throw new Error(`Backup encryption key ${header.keyId} is not configured.`);
  const ivStart = headerEnd + 1;
  const iv = Buffer.from(input).subarray(ivStart, ivStart + 12);
  const tag = Buffer.from(input).subarray(input.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(headerBytes);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(Buffer.from(input).subarray(ivStart + 12, input.length - 16)), decipher.final()]);
  const checksum = crypto.createHash("sha256").update(plain).digest("hex");
  if (checksum !== header.checksum) throw new Error("Backup checksum verification failed.");
  return { plain, header };
}
