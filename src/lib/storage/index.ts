import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { decryptBytes, encryptBytes, sha256 } from "@/lib/security/encryption";

export type StoredObject = { key: string; provider: "LOCAL" | "S3"; checksum: string; size: number };

function safeKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) throw new Error("Invalid storage key.");
  return normalized;
}

function localPath(key: string) {
  const root = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "storage");
  const resolved = path.resolve(root, safeKey(key));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid local storage path.");
  return resolved;
}

function s3() {
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined,
  });
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredObject> {
  const normalized = safeKey(key);
  const encrypted = encryptBytes(bytes);
  if (env.STORAGE_PROVIDER === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: normalized, Body: encrypted, ContentType: "application/octet-stream", ServerSideEncryption: "AES256", Metadata: { originalContentType: contentType, encrypted: "aes-256-gcm" } }));
    return { key: normalized, provider: "S3", checksum: sha256(bytes), size: bytes.length };
  }
  const destination = localPath(normalized);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, encrypted);
  return { key: normalized, provider: "LOCAL", checksum: sha256(bytes), size: bytes.length };
}

export async function getObject(key: string) {
  const normalized = safeKey(key);
  if (env.STORAGE_PROVIDER === "s3") {
    const result = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: normalized }));
    if (!result.Body) throw new Error("Stored object has no content.");
    return decryptBytes(await result.Body.transformToByteArray());
  }
  return decryptBytes(await fs.readFile(localPath(normalized)));
}

export async function deleteObject(key: string) {
  const normalized = safeKey(key);
  if (env.STORAGE_PROVIDER === "s3") await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: normalized }));
  else await fs.rm(localPath(normalized), { force: true });
}

export async function getLegacyOrStoredObject(input: { storageKey: string | null; storagePath: string | null }) {
  if (input.storageKey) return getObject(input.storageKey);
  if (!input.storagePath) throw new Error("Document storage location is missing.");
  const normalized = input.storagePath.replaceAll("\\", "/");
  const legacyPath = normalized.startsWith("fixtures/") ? path.join(/*turbopackIgnore: true*/ process.cwd(), "fixtures", path.basename(normalized)) : normalized.startsWith("uploads/") ? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads", path.basename(normalized)) : null;
  if (!legacyPath) throw new Error("Legacy document path is outside an allowed storage directory.");
  return new Uint8Array(await fs.readFile(legacyPath));
}
