import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { resolveLocalDatabaseUrl } from "./local-database.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Copy .env.example to .env before running demo:reset.");
const { databasePath } = resolveLocalDatabaseUrl(process.cwd(), process.env.DATABASE_URL);
const dataMode = process.env.DATA_MODE ?? "synthetic";
if (dataMode !== "synthetic") throw new Error("Real applicant-data mode is not implemented or approved.");
if (!process.argv.includes("--yes")) {
  throw new Error("DESTRUCTIVE SYNTHETIC RESET NOT RUN. This deletes and recreates the disposable demo database. Confirm with `npm run demo:reset -- --yes`.");
}
console.warn(`DESTRUCTIVE SYNTHETIC RESET: deleting and recreating ${path.relative(process.cwd(), databasePath)}. No production target is permitted.`);

const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
const child = spawn(process.execPath, [prismaCli, "migrate", "reset", "--force", "--schema", "prisma/schema.prisma"], {
  cwd: process.cwd(),
  env: { ...process.env, DATA_MODE: dataMode, SYNTHETIC_SEED_CONTEXT: "local-reset" },
  stdio: "inherit",
});
const code = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (exitCode) => resolve(exitCode ?? 1));
});
if (code !== 0) throw new Error(`Synthetic database reset exited with code ${code}.`);
