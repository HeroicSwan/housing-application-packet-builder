import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { countApplicationRows } from "./application-data.mjs";
import { resolveLocalDatabaseUrl } from "./local-database.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Copy .env.example to .env before running db:setup.");
resolveLocalDatabaseUrl(process.cwd(), process.env.DATABASE_URL);
const dataMode = process.env.DATA_MODE ?? "synthetic";
if (dataMode !== "synthetic") throw new Error("Local SQLite tooling only runs in the synthetic profile. Production deployments use PostgreSQL, start blank, and are claimed once through /setup (see docs/production-operations.md).");

const db = new PrismaClient();
const existingRows = await countApplicationRows(db);
await db.$disconnect();

if (existingRows) {
  console.log("Existing local data was preserved. Run `npm run demo:reset -- --yes` for an explicit synthetic reset.");
} else {
  const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
  const child = spawn(process.execPath, [prismaCli, "db", "seed", "--schema", "prisma/schema.prisma"], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_MODE: dataMode, SYNTHETIC_SEED_CONTEXT: "local-empty" },
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) throw new Error(`Synthetic seed exited with code ${code}.`);
}
