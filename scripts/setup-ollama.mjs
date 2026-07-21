import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repositoryRoot, ".env");
const model = "qwen2.5vl:7b";
const verify = process.argv.includes("--verify");
const checkOnly = process.argv.includes("--check");

function run(command, args, label, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
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

function parseEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return values;
}

async function commandExists() {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  try {
    const result = await run(locator, ["ollama"], "Locating Ollama", true);
    return result.stdout.split(/\r?\n/).find(Boolean) || "ollama";
  } catch {
    throw new Error("Ollama was not found. Install it from https://ollama.com/download, open a new terminal, and rerun npm run setup -- --ollama.");
  }
}

async function updateEnvironment() {
  if (!fs.existsSync(envPath)) throw new Error(".env does not exist. Run npm run setup first.");
  const values = parseEnv(await fs.promises.readFile(envPath, "utf8"));
  if (values.DATA_MODE && values.DATA_MODE !== "synthetic") throw new Error("The local Ollama bootstrap only changes a synthetic .env. Production AI configuration must be approved and managed outside this command.");
  let content = await fs.promises.readFile(envPath, "utf8");
  const updates = {
    DOCUMENT_PROCESSOR: "ollama",
    OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    OLLAMA_MODEL: model,
    OLLAMA_API_KEY: "",
    DOCUMENT_PROCESSOR_TIMEOUT_MS: "120000",
  };
  for (const [name, value] of Object.entries(updates)) {
    const line = `${name}=\"${value}\"`;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.replace(/\n*$/, "\n")}${line}\n`;
  }
  await fs.promises.writeFile(envPath, content, { mode: 0o600 });
}

async function main() {
  const ollama = await commandExists();
  const version = await run(ollama, ["--version"], "Checking Ollama version", true);
  console.log(`[setup:ollama] ${version.stdout}`);
  const listed = await run(ollama, ["list"], "Checking installed models", true);
  const installed = listed.stdout.split(/\r?\n/).some((line) => new RegExp(`^${model.replace(".", "\\.")}\\s`).test(line.trim()));
  if (!installed && checkOnly) throw new Error(`The exact model ${model} is not installed. Run npm run setup:ollama to download it.`);
  if (!installed) await run(ollama, ["pull", model], `Downloading ${model}`);
  if (!checkOnly) await updateEnvironment();
  if (verify) {
    const result = await run(ollama, ["run", model, "Reply with exactly: OLLAMA_READY"], "Running the local Ollama smoke test", true);
    if (!result.stdout.includes("OLLAMA_READY")) throw new Error("Ollama responded, but the expected smoke-test text was not returned.");
    console.log("[setup:ollama] Local model smoke test passed.");
  }
  console.log(`[setup:ollama] Ready: ${model} at http://127.0.0.1:11434.`);
  if (!verify) console.log("[setup:ollama] Run npm run ai:check to verify an inference before using document extraction.");
}

main().catch((error) => {
  console.error(`[setup:ollama] Failed: ${error instanceof Error ? error.message : "Unknown error."}`);
  process.exitCode = 1;
});
