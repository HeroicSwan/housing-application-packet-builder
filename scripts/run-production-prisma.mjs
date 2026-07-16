import { spawn } from "node:child_process";
import path from "node:path";
import "./generate-production-schema.mjs";

const command = process.argv[2];
if (!['generate', 'validate'].includes(command)) throw new Error("Expected generate or validate.");
const configuredUrl = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;
const databaseUrl = configuredUrl?.startsWith("postgres") ? configuredUrl : "postgresql://schema-validation:local-only@127.0.0.1:5432/schema_validation";
const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
const child = spawn(process.execPath, [prismaCli, command, "--schema", "prisma/production/schema.prisma"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});
const code = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (exitCode) => resolve(exitCode ?? 1));
});
if (code !== 0) process.exitCode = code;
