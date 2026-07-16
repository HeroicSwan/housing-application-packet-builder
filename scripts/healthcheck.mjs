import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const startTemporaryApp = args.includes("--start");

function option(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

function readEnvFile() {
  const envPath = path.join(repositoryRoot, ".env");
  if (!fs.existsSync(envPath)) return {};
  const values = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return values;
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function check(baseUrl) {
  const endpoint = new URL("/api/health", baseUrl);
  const response = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== "ok" || body?.database !== "available") {
    throw new Error(`Health endpoint returned HTTP ${response.status} without an available database.`);
  }
  return { endpoint, body };
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + 90_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Temporary application exited with code ${child.exitCode}. ${output().trim()}`.trim());
    try {
      return await check(baseUrl);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Temporary application did not become healthy within 90 seconds. ${lastError instanceof Error ? lastError.message : ""} ${output().trim()}`.trim());
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

let child;
let temporaryDistDirectory;
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop(child); });

try {
  const fileEnvironment = readEnvFile();
  let baseUrl = option("--url") ?? process.env.APP_URL ?? fileEnvironment.APP_URL ?? "http://localhost:3000";
  if (startTemporaryApp) {
    const databaseUrl = process.env.DATABASE_URL ?? fileEnvironment.DATABASE_URL;
    const dataMode = process.env.DATA_MODE ?? fileEnvironment.DATA_MODE ?? "synthetic";
    if (!/^file:\.\/(?:dev|synthetic-[a-z0-9][a-z0-9._-]*)\.db$/i.test(databaseUrl ?? "") || dataMode !== "synthetic") {
      throw new Error("Temporary health startup requires a guarded local synthetic SQLite DATABASE_URL in .env.");
    }
    if (!option("--url")) baseUrl = `http://127.0.0.1:${await availablePort()}`;
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
      throw new Error("Temporary health startup requires an http://localhost or http://127.0.0.1 URL.");
    }
    const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
    if (!fs.existsSync(nextCli)) throw new Error("Next.js is not installed. Run npm ci before using --start.");
    let captured = "";
    temporaryDistDirectory = path.join(repositoryRoot, `.next-health-${process.pid}`);
    child = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", parsedUrl.port || "80"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        APP_URL: baseUrl,
        DATABASE_URL: databaseUrl,
        DATA_MODE: "synthetic",
        DOCUMENT_PROCESSOR: "mock",
        E2E_RUN_ID: `health-${Date.now().toString(36)}-${process.pid}`,
        ENABLE_DEMO_LOGIN: "true",
        ENFORCE_PRODUCTION_CONFIG: "false",
        NEXT_TEMP_DIST_DIR: path.basename(temporaryDistDirectory),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const collect = (chunk) => { captured = `${captured}${chunk}`.slice(-4_000); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => { captured = `${captured}\n${error.message}`; });
    try {
      const result = await waitForHealth(baseUrl, child, () => captured);
      console.log(`Health check passed: ${result.endpoint} (${result.body.database}, ${result.body.latencyMs ?? "unknown"} ms).`);
    } finally {
      await stop(child);
      const resolvedDistDirectory = path.resolve(temporaryDistDirectory);
      if (resolvedDistDirectory.startsWith(`${repositoryRoot}${path.sep}`) && path.basename(resolvedDistDirectory).startsWith(".next-health-")) {
        await fs.promises.rm(resolvedDistDirectory, { force: true, recursive: true });
      }
      console.log("Temporary application stopped cleanly.");
    }
  } else {
    const result = await check(baseUrl);
    console.log(`Health check passed: ${result.endpoint} (${result.body.database}, ${result.body.latencyMs ?? "unknown"} ms).`);
  }
} catch (error) {
  console.error(`[healthcheck] ${error instanceof Error ? error.message : "Health check failed."}`);
  process.exitCode = 1;
}
