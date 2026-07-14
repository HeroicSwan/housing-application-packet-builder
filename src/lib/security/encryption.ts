import crypto from "node:crypto";
import { env } from "@/lib/env";

const prefix = "HAPB1";

function key() {
  if (env.DATA_ENCRYPTION_KEY) {
    const decoded = Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");
    if (decoded.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    return decoded;
  }
  return crypto.createHash("sha256").update(env.SESSION_SECRET).digest();
}

export function encryptBytes(value: Uint8Array) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([Buffer.from(prefix), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBytes(value: Uint8Array) {
  const buffer = Buffer.from(value);
  if (buffer.subarray(0, prefix.length).toString() !== prefix) return buffer;
  const iv = buffer.subarray(5, 17);
  const tag = buffer.subarray(17, 33);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(33)), decipher.final()]);
}

export function encryptText(value: string) {
  return encryptBytes(Buffer.from(value)).toString("base64");
}

export function decryptText(value: string) {
  return decryptBytes(Buffer.from(value, "base64")).toString();
}

export function sha256(value: Uint8Array | string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
