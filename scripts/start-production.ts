import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { ZodError } from "zod";
import { parseEnvironment } from "../src/lib/env-schema";

const repositoryRoot = process.cwd();
config({ path: [".env.production.local", ".env.local", ".env.production", ".env"], override: false, quiet: true });
const configOnly = process.argv.includes("--config-only");
const checkOnly = process.argv.includes("--check");

function redactedConfigurationError(error: unknown) {
  if (error instanceof ZodError) return error.issues.map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`).join("\n");
  return error instanceof Error ? error.message : "Production preflight failed.";
}

function runPrismaMigrationStatus(databaseUrl: string) {
  const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, "migrate", "status", "--schema", "prisma/production/schema.prisma"], {
      cwd: repositoryRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Production migrations are pending or migration status is unavailable. Run the documented pre-deployment migration procedure.")));
  });
}

async function rejectSyntheticCredentials(databaseUrl: string) {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const syntheticUsers = await db.user.count({ where: { email: { endsWith: "@example.org" } } });
    if (syntheticUsers) throw new Error("Synthetic demo accounts are present in the production database. Remove them through the documented production account procedure before startup.");
  } finally {
    await db.$disconnect();
  }
}

async function requireHealthyWorker(workerHealthUrl: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(workerHealthUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(3_000) });
      const body = await response.json() as { status?: string };
      if (response.ok && body.status === "ok") return;
    } catch {
      // The final error below is intentionally redacted and actionable.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The required background worker is unavailable. Start the production worker and confirm WORKER_HEALTH_URL before retrying startup.");
}

async function main() {
  const env = parseEnvironment({ ...process.env, ENFORCE_PRODUCTION_CONFIG: "true" });
  console.log("Production configuration validation passed (secret values were not printed).");
  if (configOnly) return;

  if (!fs.existsSync(path.join(repositoryRoot, ".next", "BUILD_ID"))) throw new Error("The production build is missing. Run npm run build before production startup.");
  await runPrismaMigrationStatus(env.SYSTEM_DATABASE_URL!);
  await rejectSyntheticCredentials(env.SYSTEM_DATABASE_URL!);
  await requireHealthyWorker(env.WORKER_HEALTH_URL!);
  console.log("Production preflight passed: build, migrations, account boundary, and worker health are ready.");
  if (checkOnly) return;

  const standaloneServer = path.join(repositoryRoot, "server.js");
  const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
  const serverArguments = fs.existsSync(standaloneServer)
    ? [standaloneServer]
    : [nextCli, "start", ...process.argv.slice(2).filter((argument) => !["--check", "--config-only"].includes(argument))];
  const child = spawn(process.execPath, serverArguments, {
    cwd: repositoryRoot,
    env: { ...process.env, ENFORCE_PRODUCTION_CONFIG: "true" },
    stdio: "inherit",
    windowsHide: true,
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  if (result.signal) throw new Error(`Production server stopped by ${result.signal}.`);
  if (result.code !== 0) throw new Error(`Production server exited with code ${result.code ?? 1}.`);
}

main().catch((error) => {
  console.error(`[production] ${redactedConfigurationError(error)}`);
  process.exitCode = 1;
});
