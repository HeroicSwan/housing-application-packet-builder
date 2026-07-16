import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createE2eDatabaseTarget } from "./e2e-database.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = `${Date.now().toString(36)}-${process.pid}-${randomBytes(4).toString("hex")}`;
const target = createE2eDatabaseTarget(repositoryRoot, runId);
const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
const playwrightCli = path.join(repositoryRoot, "node_modules", "@playwright", "test", "cli.js");
const schemaPath = path.join(repositoryRoot, "prisma", "schema.prisma");
const storagePath = path.join(repositoryRoot, ".data", "e2e", runId);
const distPath = path.join(repositoryRoot, ".next-e2e");
const providerKeyNames = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "SAMBANOVA_API_KEY",
  "CEREBRAS_API_KEY",
  "MISTRAL_API_KEY",
];

const childEnvironment = {
  ...process.env,
  APP_URL: "http://127.0.0.1:3100",
  DATA_MODE: "synthetic",
  DATA_ENCRYPTION_KEY: "",
  DATABASE_URL: target.databaseUrl,
  DOCUMENT_PROCESSOR: "mock",
  E2E_DATABASE_URL: target.databaseUrl,
  E2E_PORT: "3100",
  E2E_RUN_ID: runId,
  ENABLE_DEMO_LOGIN: "true",
  DEMO_BANNER: "true",
  ENFORCE_PRODUCTION_CONFIG: "false",
  LOCAL_STORAGE_ROOT: path.relative(repositoryRoot, storagePath),
  MALWARE_SCANNER: "none",
  MONITORING_TOKEN: "synthetic-e2e-monitoring-token-with-32-characters",
  OPENROUTER_HTTP_REFERER: "",
  S3_ACCESS_KEY_ID: "",
  S3_BUCKET: "",
  S3_ENDPOINT: "",
  S3_SECRET_ACCESS_KEY: "",
  SESSION_SECRET: "synthetic-e2e-session-secret-with-at-least-32-characters",
  SMTP_HOST: "",
  SMTP_PASSWORD: "",
  SMTP_USER: "",
  STORAGE_PROVIDER: "local",
  SYNTHETIC_SEED_CONTEXT: "e2e",
};
for (const key of providerKeyNames) childEnvironment[key] = "";

let activeChild;

function runNodeScript(scriptPath, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`[e2e] ${label}`);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repositoryRoot,
      env: childEnvironment,
      stdio: "inherit",
    });
    activeChild = child;
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      activeChild = undefined;
      if (signal) reject(new Error(`${label} stopped by ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

async function requireSuccessfulNodeScript(scriptPath, args, label) {
  const code = await runNodeScript(scriptPath, args, label);
  if (code !== 0) throw new Error(`${label} exited with code ${code}.`);
}

async function ensurePrismaClient() {
  const generatedDirectory = path.join(repositoryRoot, "node_modules", ".prisma", "client");
  const generatedSchema = path.join(generatedDirectory, "schema.prisma");
  const sourceMtime = fs.statSync(schemaPath).mtimeMs;
  const generatedMtime = fs.existsSync(generatedSchema) ? fs.statSync(generatedSchema).mtimeMs : 0;
  const hasEngine = fs.existsSync(generatedDirectory)
    && fs.readdirSync(generatedDirectory).some((name) => /(?:lib)?query_engine/.test(name) && !name.includes(".tmp"));

  if (!hasEngine || generatedMtime < sourceMtime) {
    await requireSuccessfulNodeScript(prismaCli, ["generate", "--schema", schemaPath], "Generating Prisma Client");
  } else {
    console.log("[e2e] Prisma Client is already generated for the current schema");
  }
}

async function removeWithRetry(targetPath) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await fs.promises.rm(targetPath, { force: true, recursive: true });
      return;
    } catch (error) {
      if (attempt === 7 || !["EBUSY", "EPERM"].includes(error.code)) {
        console.warn(`[e2e] Cleanup warning for ${path.relative(repositoryRoot, targetPath)} (${error.code ?? "unknown error"}).`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

function forwardSignal(signal) {
  if (activeChild && activeChild.exitCode === null) activeChild.kill(signal);
}
process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));

let exitCode = 1;
try {
  fs.mkdirSync(target.databaseDirectory, { recursive: true });
  fs.closeSync(fs.openSync(target.databasePath, "a"));
  console.log(`[e2e] Isolated database: prisma/.e2e/${target.filename}`);
  await ensurePrismaClient();
  await requireSuccessfulNodeScript(prismaCli, ["migrate", "deploy", "--schema", schemaPath], "Applying E2E migrations");
  await requireSuccessfulNodeScript(prismaCli, ["db", "seed", "--schema", schemaPath], "Seeding synthetic E2E data");
  exitCode = await runNodeScript(playwrightCli, ["test", ...process.argv.slice(2)], "Running Playwright");
} catch (error) {
  console.error(`[e2e] ${error instanceof Error ? error.message : "E2E setup failed."}`);
} finally {
  await removeWithRetry(target.databasePath);
  await removeWithRetry(`${target.databasePath}-journal`);
  await removeWithRetry(`${target.databasePath}-shm`);
  await removeWithRetry(`${target.databasePath}-wal`);
  await removeWithRetry(storagePath);
  await removeWithRetry(distPath);
}

process.exitCode = exitCode;
