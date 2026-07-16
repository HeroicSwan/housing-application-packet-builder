import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const shouldStart = args.includes("--start");

function option(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

function localEnvironment() {
  const envPath = path.join(repositoryRoot, ".env");
  if (!fs.existsSync(envPath)) return {};
  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return values;
}

async function healthy(baseUrl) {
  try {
    const response = await fetch(new URL("/api/health", baseUrl), { signal: AbortSignal.timeout(2_000) });
    const body = await response.json();
    return response.ok && body.status === "ok" && body.database === "available";
  } catch {
    return false;
  }
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local application exited with code ${child.exitCode}.`);
    if (await healthy(baseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local application did not become healthy within 90 seconds.");
}

const fileEnvironment = localEnvironment();
const appUrl = option("--url") ?? process.env.APP_URL ?? fileEnvironment.APP_URL ?? "http://localhost:3000";
let child;
let temporaryDistDirectory;

async function stop(signal = "SIGTERM") {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill(signal);
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}
process.once("SIGINT", () => { void stop("SIGINT"); });
process.once("SIGTERM", () => { void stop("SIGTERM"); });

try {
  if (shouldStart && !(await healthy(appUrl))) {
    const parsedUrl = new URL(appUrl);
    if (parsedUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
      throw new Error("--start requires an http://localhost or http://127.0.0.1 APP_URL.");
    }
    const databaseUrl = process.env.DATABASE_URL ?? fileEnvironment.DATABASE_URL;
    const dataMode = process.env.DATA_MODE ?? fileEnvironment.DATA_MODE ?? "synthetic";
    if (!/^file:\.\/(?:dev|synthetic-[a-z0-9][a-z0-9._-]*)\.db$/i.test(databaseUrl ?? "") || dataMode !== "synthetic") {
      throw new Error("--start requires a guarded local synthetic SQLite database in .env.");
    }
    const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
    if (!fs.existsSync(nextCli)) throw new Error("Next.js is not installed. Run npm ci before using --start.");
    temporaryDistDirectory = path.join(repositoryRoot, `.next-open-${process.pid}`);
    child = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", parsedUrl.port || "80"], {
      cwd: repositoryRoot,
      env: { ...process.env, APP_URL: appUrl, DATABASE_URL: databaseUrl, DATA_MODE: "synthetic", DOCUMENT_PROCESSOR: "mock", ENABLE_DEMO_LOGIN: "true", ENFORCE_PRODUCTION_CONFIG: "false", NEXT_TEMP_DIST_DIR: path.basename(temporaryDistDirectory) },
      stdio: "inherit",
    });
    await waitForHealth(appUrl, child);
  }
  await open(appUrl);
  console.log(`Opened ${appUrl}`);
  if (child) {
    console.log("Local application is running. Press Ctrl+C to stop it.");
    const result = await new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    if (result.signal && !["SIGINT", "SIGTERM"].includes(result.signal)) throw new Error(`Local application stopped by ${result.signal}.`);
    if (result.code && result.code !== 0) throw new Error(`Local application exited with code ${result.code}.`);
  }
} catch (error) {
  await stop();
  console.error(`[open] ${error instanceof Error ? error.message : "Unable to open the local application."}`);
  process.exitCode = 1;
} finally {
  if (temporaryDistDirectory) {
    const resolvedDistDirectory = path.resolve(temporaryDistDirectory);
    if (resolvedDistDirectory.startsWith(`${repositoryRoot}${path.sep}`) && path.basename(resolvedDistDirectory).startsWith(".next-open-") && (!child || child.exitCode !== null)) {
      await fs.promises.rm(resolvedDistDirectory, { force: true, recursive: true });
    }
  }
}
