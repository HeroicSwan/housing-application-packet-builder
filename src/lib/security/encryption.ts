import crypto from "node:crypto";
import { env } from "@/lib/env";

const currentPrefix = "HAPB2";
const legacyPrefix = "HAPB1";

function decodeKey(value: string) {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) throw new Error("Encryption keys must be canonical Base64 for exactly 32 bytes.");
  return decoded;
}

function currentKey() {
  return env.DATA_ENCRYPTION_KEY ? decodeKey(env.DATA_ENCRYPTION_KEY) : crypto.createHash("sha256").update(env.SESSION_SECRET).digest();
}

function keyRing() {
  const keys = new Map<string, Buffer>([[env.DATA_ENCRYPTION_KEY_ID, currentKey()]]);
  if (env.DATA_ENCRYPTION_PREVIOUS_KEYS) {
    const previous = JSON.parse(env.DATA_ENCRYPTION_PREVIOUS_KEYS) as Record<string, string>;
    for (const [keyId, value] of Object.entries(previous)) keys.set(keyId, decodeKey(value));
  }
  return keys;
}

export function encryptBytes(value: Uint8Array) {
  const keyId = Buffer.from(env.DATA_ENCRYPTION_KEY_ID);
  if (keyId.length > 255) throw new Error("Encryption key ID is too long.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", currentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([Buffer.from(currentPrefix), Buffer.from([keyId.length]), keyId, iv, cipher.getAuthTag(), ciphertext]);
}

function decryptWithKey(buffer: Buffer, key: Buffer, offset: number) {
  const iv = buffer.subarray(offset, offset + 12);
  const tag = buffer.subarray(offset + 12, offset + 28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(offset + 28)), decipher.final()]);
}

export function decryptBytes(value: Uint8Array) {
  const buffer = Buffer.from(value);
  const prefix = buffer.subarray(0, 5).toString();
  if (prefix === currentPrefix) {
    const keyIdLength = buffer[5];
    const keyId = buffer.subarray(6, 6 + keyIdLength).toString();
    const key = keyRing().get(keyId);
    if (!key) throw new Error(`Encryption key ${keyId} is not available.`);
    return decryptWithKey(buffer, key, 6 + keyIdLength);
  }
  if (prefix === legacyPrefix) {
    for (const key of keyRing().values()) {
      try { return decryptWithKey(buffer, key, 5); } catch { continue; }
    }
    throw new Error("No configured key can decrypt the legacy envelope.");
  }
  throw new Error("Stored data is missing a recognized authenticated encryption envelope.");
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
