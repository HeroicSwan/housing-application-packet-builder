import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const run = await db.backupRun.create({ data: { status: "RUNNING", provider: process.env.STORAGE_PROVIDER === "s3" ? "S3" : "LOCAL" } });
const stamp = new Date().toISOString().replaceAll(":", "-"); const key = `backups/database-${stamp}.sqlite.enc`; const temporary = path.resolve("tmp", `database-${stamp}.sqlite`);
try {
  if (!process.env.DATABASE_URL?.startsWith("file:")) throw new Error("The bundled backup job currently supports the deployed SQLite profile.");
  await fs.mkdir(path.dirname(temporary), { recursive: true });
  await db.$executeRawUnsafe(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
  const plain = await fs.readFile(temporary); const keyMaterial = process.env.DATA_ENCRYPTION_KEY ? Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64") : crypto.createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest(); if (keyMaterial.length !== 32) throw new Error("A valid 32-byte DATA_ENCRYPTION_KEY is required.");
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial, iv); const encrypted = Buffer.concat([Buffer.from("HAPB1"), iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()]); const checksum = crypto.createHash("sha256").update(plain).digest("hex");
  if (process.env.STORAGE_PROVIDER === "s3") {
    const client = new S3Client({ region: process.env.S3_REGION ?? "us-east-1", endpoint: process.env.S3_ENDPOINT, forcePathStyle: Boolean(process.env.S3_ENDPOINT), credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } : undefined });
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: encrypted, ServerSideEncryption: "AES256", Metadata: { checksum } }));
  } else {
    const destination = path.resolve(process.env.LOCAL_STORAGE_ROOT ?? ".data/storage", key); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, encrypted);
  }
  await db.backupRun.update({ where: { id: run.id }, data: { status: "COMPLETED", storageKey: key, checksum, completedAt: new Date() } });
  console.log(JSON.stringify({ event: "database_backup_completed", key, checksum, at: new Date().toISOString() }));
} catch (error) {
  await db.backupRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Backup failed", completedAt: new Date() } });
  throw error;
} finally { await fs.rm(temporary, { force: true }); await db.$disconnect(); }
