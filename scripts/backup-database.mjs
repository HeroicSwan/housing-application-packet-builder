import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { encryptBackup } from "./backup-envelope.mjs";

const execute = promisify(execFile);
if (!['synthetic', 'production'].includes(process.env.DATA_MODE ?? 'synthetic')) throw new Error("DATA_MODE must be synthetic or production.");
const databaseUrl = process.env.DATABASE_URL ?? "";
const kind = databaseUrl.startsWith("file:") ? "sqlite" : databaseUrl.startsWith("postgres") ? "postgresql" : null;
if (!kind) throw new Error("DATABASE_URL must use SQLite or PostgreSQL.");
const db = new PrismaClient();
const run = await db.backupRun.create({ data: { status: "RUNNING", provider: process.env.STORAGE_PROVIDER === "s3" ? "S3" : "LOCAL" } });
const stamp = new Date().toISOString().replaceAll(":", "-");
const extension = kind === "sqlite" ? "sqlite" : "pgdump";
const key = `backups/database-${stamp}.${extension}.enc`;
const temporary = path.resolve("tmp", `database-${stamp}.${extension}`);
try {
  await fs.mkdir(path.dirname(temporary), { recursive: true });
  if (kind === "sqlite") await db.$executeRawUnsafe(`VACUUM INTO '${temporary.replaceAll("'", "''")}'`);
  else await execute("pg_dump", ["--dbname", databaseUrl, "--format=custom", "--no-owner", "--no-acl", "--file", temporary], { windowsHide: true });
  const plain = await fs.readFile(temporary);
  const encrypted = encryptBackup(plain, kind);
  if (process.env.STORAGE_PROVIDER === "s3") {
    const client = new S3Client({ region: process.env.S3_REGION ?? "us-east-1", endpoint: process.env.S3_ENDPOINT, forcePathStyle: Boolean(process.env.S3_ENDPOINT), credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } : undefined });
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: encrypted.bytes, ...(process.env.S3_SERVER_SIDE_ENCRYPTION !== "false" ? { ServerSideEncryption: "AES256" } : {}), Metadata: { checksum: encrypted.checksum, database: kind } }));
  } else {
    const destination = path.resolve(process.env.LOCAL_STORAGE_ROOT ?? ".data/storage", key);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, encrypted.bytes);
  }
  await db.backupRun.update({ where: { id: run.id }, data: { status: "COMPLETED", storageKey: key, checksum: encrypted.checksum, completedAt: new Date() } });
  console.log(JSON.stringify({ event: "database_backup_completed", database: kind, key, checksum: encrypted.checksum, at: new Date().toISOString() }));
} catch (error) {
  await db.backupRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Backup failed", completedAt: new Date() } });
  throw error;
} finally {
  await fs.rm(temporary, { force: true });
  await db.$disconnect();
}
