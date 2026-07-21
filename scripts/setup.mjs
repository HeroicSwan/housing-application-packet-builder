import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repositoryRoot, ".env");
const envExamplePath = path.join(repositoryRoot, ".env.example");
// --blank: prepare an empty installation with no demo accounts and no synthetic
// records. The first organization and administrator are created once through
// /setup using the one-time bootstrap token printed at the end of this script.
const blankInstall = process.argv.includes("--blank");
const ollamaInstall = process.argv.includes("--ollama");

function major(version) {
  return Number(version.replace(/^v/, "").split(".")[0]);
}

function run(command, args, label, capture = false) {
  return new Promise((resolve, reject) => {
    console.log(`[setup] ${label}`);
    const child = spawn(command, args, { cwd: repositoryRoot, env: process.env, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", windowsHide: true });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${label} stopped by ${signal}.`));
      else if (code !== 0) reject(new Error(`${label} exited with code ${code}.${stderr.trim() ? ` ${stderr.trim()}` : ""}`));
      else resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function npm(args, label, capture = false) {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) return run(process.execPath, [process.env.npm_execpath, ...args], label, capture);
  if (process.platform === "win32") return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", ...args], label, capture);
  return run("npm", args, label, capture);
}

function parseEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return values;
}

async function ensureEnvironment() {
  let created = false;
  try {
    await fs.promises.copyFile(envExamplePath, envPath, fs.constants.COPYFILE_EXCL);
    created = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  if (!created) {
    console.log("[setup] Existing .env preserved without changes.");
    return;
  }
  let content = await fs.promises.readFile(envPath, "utf8");
  content = content.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET="${randomBytes(48).toString("base64url")}"`);
  content = content.replace(/^DATA_ENCRYPTION_KEY=.*$/m, `DATA_ENCRYPTION_KEY="${randomBytes(32).toString("base64")}"`);
  if (blankInstall) {
    content = content.replace(/^ENABLE_DEMO_LOGIN=.*$/m, "ENABLE_DEMO_LOGIN=false");
    content = content.replace(/^DEMO_BANNER=.*$/m, "DEMO_BANNER=false");
  }
  await fs.promises.writeFile(envPath, content, { mode: 0o600 });
  console.log(`[setup] Created .env with new local-only session and encryption keys${blankInstall ? " (blank installation: demo login and banner disabled)" : ""}.`);
}

async function upsertEnvValue(name, value) {
  let content = await fs.promises.readFile(envPath, "utf8");
  const line = `${name}="${value}"`;
  if (new RegExp(`^${name}=`, "m").test(content)) content = content.replace(new RegExp(`^${name}=.*$`, "m"), line);
  else content = `${content.replace(/\n*$/, "\n")}${line}\n`;
  await fs.promises.writeFile(envPath, content, { mode: 0o600 });
}

async function prepareBlankBootstrap(environment) {
  if (environment.SETUP_BOOTSTRAP_TOKEN_HASH) {
    console.log("[setup] Existing SETUP_BOOTSTRAP_TOKEN_HASH preserved; use your previously generated claim token at /setup.");
    return null;
  }
  const { createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  await upsertEnvValue("SETUP_BOOTSTRAP_TOKEN_HASH", createHash("sha256").update(token).digest("hex"));
  return token;
}

async function writableDirectory(directory, label) {
  await fs.promises.mkdir(directory, { recursive: true });
  const probe = path.join(directory, `.setup-write-${process.pid}-${randomBytes(4).toString("hex")}`);
  await fs.promises.writeFile(probe, "synthetic setup probe", { flag: "wx" });
  await fs.promises.rm(probe, { force: true });
  console.log(`[setup] ${label} is writable: ${path.relative(repositoryRoot, directory)}`);
}

async function verifyLocalPaths(environment) {
  if ((environment.DATA_MODE ?? "synthetic") !== "synthetic") throw new Error("Local setup requires DATA_MODE=synthetic.");
  if ((environment.STORAGE_PROVIDER ?? "local") !== "local") throw new Error("Local setup requires STORAGE_PROVIDER=local.");
  if (!/^file:\.\/(?:dev|synthetic-[a-z0-9][a-z0-9._-]*)\.db$/i.test(environment.DATABASE_URL ?? "")) {
    throw new Error("Local setup requires DATABASE_URL=file:./dev.db or file:./synthetic-<name>.db.");
  }
  const fixtureDirectory = path.join(repositoryRoot, "fixtures");
  const fixturePath = path.join(fixtureDirectory, "family-pathways-agency-acroform.pdf");
  await fs.promises.access(fixtureDirectory, fs.constants.R_OK);
  const fixtureHeader = Buffer.alloc(5);
  const fixture = await fs.promises.open(fixturePath, "r");
  try { await fixture.read(fixtureHeader, 0, 5, 0); } finally { await fixture.close(); }
  if (fixtureHeader.toString() !== "%PDF-") throw new Error("The synthetic AcroForm fixture is missing or is not a PDF.");
  console.log("[setup] Synthetic PDF fixture is readable.");
  const storageRoot = path.resolve(repositoryRoot, environment.LOCAL_STORAGE_ROOT || ".data/storage");
  await writableDirectory(storageRoot, "Local encrypted storage");
  await writableDirectory(path.join(storageRoot, "documents"), "Upload path");
  await writableDirectory(path.join(repositoryRoot, "output", "pdf"), "Generated PDF path");
}

try {
  await run(process.execPath, [path.join(repositoryRoot, "scripts", "doctor.mjs")], "Checking local prerequisites");
  if (major(process.versions.node) < 22) throw new Error(`Node.js 22 or newer is required; found ${process.version}. Install a supported Node.js release and rerun setup.`);
  const npmVersion = (await npm(["--version"], "Checking npm version", true)).stdout;
  if (major(npmVersion) < 10) throw new Error(`npm 10 or newer is required; found ${npmVersion}. Upgrade npm and rerun setup.`);
  console.log(`[setup] Runtime accepted: Node ${process.version}, npm ${npmVersion}.`);
  await ensureEnvironment();
  if (fs.existsSync(path.join(repositoryRoot, "node_modules"))) await npm(["ls", "--depth=0"], "Validating installed dependencies");
  else await npm(["ci"], "Installing locked dependencies");
  await npm(["run", "db:generate"], "Generating Prisma Client");
  await npm(["run", blankInstall ? "db:setup:blank" : "db:setup"], blankInstall ? "Creating or preserving an empty local database (no demo data)" : "Creating or preserving the synthetic SQLite database");
  const environment = parseEnv(await fs.promises.readFile(envPath, "utf8"));
  await verifyLocalPaths(environment);
  if (blankInstall) {
    const emptiness = (await run(process.execPath, [path.join(repositoryRoot, "scripts", "check-empty-db.mjs")], "Confirming the database is empty", true)).stdout.split(/\r?\n/).pop();
    if (emptiness !== "EMPTY") {
      throw new Error("Blank installation requires an empty database, but this one already contains records. Point DATABASE_URL in .env at a new file (for example file:./synthetic-org.db), or move the existing database aside, then rerun npm run setup:blank. Nothing was deleted.");
    }
  }
  const bootstrapToken = blankInstall ? await prepareBlankBootstrap(environment) : null;
  await npm(["test", "--", "tests/pdf.test.ts", "tests/document-safety.test.ts", "tests/security-and-approval.test.ts"], "Verifying PDF generation and upload safety");
  await run(process.execPath, [path.join(repositoryRoot, "scripts", "healthcheck.mjs"), "--start"], "Starting a temporary application and checking /api/health");
  if (ollamaInstall) await run(process.execPath, [path.join(repositoryRoot, "scripts", "setup-ollama.mjs")], "Installing and configuring the local Ollama model");
  const appUrl = environment.APP_URL || "http://localhost:3000";
  if (blankInstall) {
    console.log("\nBLANK INSTALLATION — no demo accounts and no synthetic records were created.");
    console.log("This local profile has NOT completed the production hardening checklist.");
    console.log("Any real data you enter is at your own risk; review README and docs/production-operations.md first.");
    console.log(`1. Start the application: npm run dev (${appUrl})`);
    if (ollamaInstall) console.log("Local AI configured: qwen2.5vl:7b (verify with npm run ai:check)");
    if (bootstrapToken) {
      console.log(`2. Open ${appUrl}/setup and claim the installation with this ONE-TIME token (shown only now):`);
      console.log(`   ${bootstrapToken}`);
      console.log("3. After the claim succeeds, remove SETUP_BOOTSTRAP_TOKEN_HASH from .env and restart.");
    } else {
      console.log(`2. Open ${appUrl}/setup and claim the installation with your previously generated token.`);
    }
  } else {
    console.log("\nSYNTHETIC DEMONSTRATION ONLY — DO NOT ENTER REAL APPLICANT INFORMATION.");
    console.log(`Local URL: ${appUrl}`);
    console.log("Demo accounts: caseworker@example.org, reviewer@example.org, admin@example.org");
    console.log("Demo password: DemoHousing2026!");
    console.log("Start: npm run dev");
    if (ollamaInstall) console.log("Local AI configured: qwen2.5vl:7b (verify with npm run ai:check)");
    console.log("Reset synthetic demo data: npm run demo:reset -- --yes");
    console.log("Prefer an empty installation for your own data? Run: npm run setup:blank");
  }
} catch (error) {
  console.error(`[setup] Failed: ${error instanceof Error ? error.message : "Unknown setup error."}`);
  console.error("Correct the reported issue and rerun setup; existing .env values were not overwritten.");
  process.exitCode = 1;
}
