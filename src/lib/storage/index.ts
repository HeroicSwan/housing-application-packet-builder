import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { env } from "@/lib/env";
import { decryptBytes, encryptBytes, sha256 } from "@/lib/security/encryption";
import { getActiveSetupSection } from "@/lib/setup/active-config";

export type StoredObject = { key: string; provider: "LOCAL" | "S3"; checksum: string; size: number };
export type StorageConfig = {
  provider: "local" | "s3";
  localRoot: string;
  bucket?: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

function safeKey(key: string) {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) throw new Error("Invalid storage key.");
  return normalized;
}

function localPath(key: string, configuredRoot: string) {
  const configured = configuredRoot.replaceAll("\\", "/").replace(/^\.data\/?/, "");
  if (!configured || path.isAbsolute(configuredRoot) || configured.split("/").includes("..")) throw new Error("LOCAL_STORAGE_ROOT must be a directory inside .data.");
  const root = path.join(process.cwd(), ".data", configured);
  const resolved = path.resolve(root, safeKey(key));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid local storage path.");
  return resolved;
}

function s3(config: StorageConfig) {
  const pinnedAddresses = new Map<string, { address: string; family: number }>();
  const pinnedLookup = (hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address?: string, family?: number) => void) => {
    const cached = pinnedAddresses.get(hostname);
    if (cached) return callback(null, cached.address, cached.family);
    lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
      const first = addresses[0];
      if (!first) throw new Error("Storage endpoint did not resolve.");
      pinnedAddresses.set(hostname, first);
      callback(null, first.address, first.family);
    }).catch((error) => callback(error as NodeJS.ErrnoException));
  };
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: config.accessKeyId && config.secretAccessKey ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } : undefined,
    requestHandler: new NodeHttpHandler({ httpAgent: new http.Agent({ lookup: pinnedLookup as never }), httpsAgent: new https.Agent({ lookup: pinnedLookup as never }) }),
  });
}

export function runtimeStorageConfig(): StorageConfig {
  return { provider: env.STORAGE_PROVIDER, localRoot: env.LOCAL_STORAGE_ROOT, bucket: env.S3_BUCKET, region: env.S3_REGION, endpoint: env.S3_ENDPOINT, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY };
}

async function activeStorageConfig(): Promise<StorageConfig> {
  const active = await getActiveSetupSection("storage");
  if (!active) return runtimeStorageConfig();
  const config = active.configuration;
  const secrets = active.secrets;
  return {
    provider: config.provider === "s3" ? "s3" : "local",
    localRoot: typeof config.localRoot === "string" ? config.localRoot : env.LOCAL_STORAGE_ROOT,
    bucket: typeof config.bucket === "string" ? config.bucket : undefined,
    region: typeof config.region === "string" ? config.region : env.S3_REGION,
    endpoint: typeof config.endpoint === "string" ? config.endpoint : undefined,
    accessKeyId: typeof config.accessKeyId === "string" ? config.accessKeyId : undefined,
    secretAccessKey: typeof secrets.secretAccessKey === "string" ? secrets.secretAccessKey : undefined,
  };
}

export function createStorage(config: StorageConfig) {
  if (config.provider === "s3" && !config.bucket) throw new Error("An object-storage bucket is required.");
  const client = config.provider === "s3" ? s3(config) : null;
  return {
    async put(key: string, bytes: Uint8Array, contentType: string, signal?: AbortSignal): Promise<StoredObject> {
      const normalized = safeKey(key);
      const encrypted = encryptBytes(bytes);
      if (client) {
        await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: normalized, Body: encrypted, ContentType: "application/octet-stream", ServerSideEncryption: "AES256", Metadata: { originalContentType: contentType, encrypted: "aes-256-gcm" } }), { abortSignal: signal });
        return { key: normalized, provider: "S3", checksum: sha256(bytes), size: bytes.length };
      }
      const destination = localPath(normalized, config.localRoot);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, encrypted, { signal });
      return { key: normalized, provider: "LOCAL", checksum: sha256(bytes), size: bytes.length };
    },
    async get(key: string, signal?: AbortSignal) {
      const normalized = safeKey(key);
      if (client) {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: normalized }), { abortSignal: signal });
        if (!result.Body) throw new Error("Stored object has no content.");
        return decryptBytes(await result.Body.transformToByteArray());
      }
      return decryptBytes(await fs.readFile(localPath(normalized, config.localRoot), { signal }));
    },
    async delete(key: string, signal?: AbortSignal) {
      const normalized = safeKey(key);
      if (client) await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: normalized }), { abortSignal: signal });
      else await fs.rm(localPath(normalized, config.localRoot), { force: true });
    },
    destroy() { client?.destroy(); },
  };
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredObject> {
  const storage = createStorage(await activeStorageConfig());
  try { return await storage.put(key, bytes, contentType); } finally { storage.destroy(); }
}

export async function getObject(key: string) {
  const storage = createStorage(await activeStorageConfig());
  try { return await storage.get(key); } finally { storage.destroy(); }
}

export async function deleteObject(key: string) {
  const storage = createStorage(await activeStorageConfig());
  try { await storage.delete(key); } finally { storage.destroy(); }
}

export async function getLegacyOrStoredObject(input: { storageKey: string | null; storagePath: string | null }) {
  if (input.storageKey) return getObject(input.storageKey);
  if (!input.storagePath) throw new Error("Document storage location is missing.");
  const normalized = input.storagePath.replaceAll("\\", "/");
  const legacyPath = normalized.startsWith("fixtures/") ? path.join(process.cwd(), "fixtures", path.basename(normalized)) : normalized.startsWith("uploads/") ? path.join(process.cwd(), "uploads", path.basename(normalized)) : null;
  if (!legacyPath) throw new Error("Legacy document path is outside an allowed storage directory.");
  return new Uint8Array(await fs.readFile(legacyPath));
}
