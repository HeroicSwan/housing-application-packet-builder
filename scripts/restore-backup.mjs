import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { decryptBackup } from "./backup-envelope.mjs";

const execute = promisify(execFile);
const filename = process.argv[2];
if (!filename) throw new Error("Pass the path to a local encrypted backup.");
const { plain, header } = decryptBackup(await fs.readFile(filename));
if (header.kind === "sqlite") {
  const targetIndex = process.argv.indexOf("--target");
  const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : null;
  if (!target) throw new Error("SQLite restoration requires --target <new-disposable-path>.");
  const resolved = path.resolve(target);
  if (await fs.stat(resolved).then(() => true).catch(() => false)) throw new Error("Restore target already exists.");
  await fs.writeFile(resolved, plain, { flag: "wx" });
  console.log(JSON.stringify({ event: "backup_restored", database: "sqlite", target: resolved, checksum: header.checksum, at: new Date().toISOString() }));
} else if (header.kind === "postgresql") {
  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  if (!restoreUrl || process.env.RESTORE_CONFIRMATION !== "RESTORE_TO_DISPOSABLE_DATABASE") throw new Error("PostgreSQL restoration requires RESTORE_DATABASE_URL and RESTORE_CONFIRMATION=RESTORE_TO_DISPOSABLE_DATABASE.");
  if (restoreUrl === process.env.DATABASE_URL || restoreUrl === process.env.SYSTEM_DATABASE_URL) throw new Error("Refusing to restore over an active application database.");
  const temporary = path.resolve("tmp", `restore-${Date.now()}.pgdump`);
  await fs.mkdir(path.dirname(temporary), { recursive: true });
  try {
    await fs.writeFile(temporary, plain);
    await execute("pg_restore", ["--dbname", restoreUrl, "--clean", "--if-exists", "--no-owner", "--no-acl", temporary], { windowsHide: true });
    const verification = await execute("psql", [restoreUrl, "--tuples-only", "--no-align", "--command", "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL;"], { windowsHide: true });
    if (Number(verification.stdout.trim()) < 1) throw new Error("Restored database did not contain completed migrations.");
    console.log(JSON.stringify({ event: "backup_restored", database: "postgresql", migrations: Number(verification.stdout.trim()), checksum: header.checksum, at: new Date().toISOString() }));
  } finally { await fs.rm(temporary, { force: true }); }
} else throw new Error("Unsupported backup database type.");
