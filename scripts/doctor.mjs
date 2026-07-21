import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredModel = "qwen2.5vl:7b";
const results = [];

function major(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

function command(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.once("error", () => resolve(null));
    child.once("exit", (code) => resolve(code === 0 ? stdout.trim() : null));
  });
}

function report(name, status, detail) {
  results.push(status === "PASS");
  console.log(`[doctor] ${status.padEnd(4)} ${name}: ${detail}`);
}

const nodeMajor = major(process.versions.node);
report("Node.js", nodeMajor >= 22 ? "PASS" : "FAIL", `${process.version} (requires 22+)`);

const npmVersion = process.platform === "win32"
  ? await command(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm", "--version"])
  : await command("npm", ["--version"]);
report("npm", npmVersion && major(npmVersion) >= 10 ? "PASS" : "FAIL", `${npmVersion || "not found"} (requires 10+)`);

const gitVersion = await command(process.platform === "win32" ? "git.exe" : "git", ["--version"]);
report("Git", gitVersion ? "PASS" : "WARN", gitVersion || "not found; only needed when cloning from GitHub");

const ollamaCommand = process.platform === "win32" ? "ollama.exe" : "ollama";
const ollamaVersion = await command(ollamaCommand, ["--version"]);
if (!ollamaVersion) {
  report("Ollama", "WARN", "not found; optional unless you enable local AI (install from https://ollama.com/download)");
} else {
  report("Ollama", "PASS", ollamaVersion);
  const models = await command(ollamaCommand, ["list"]);
  const installed = models?.split(/\r?\n/).some((line) => new RegExp(`^${requiredModel.replace(".", "\\.")}\\s`).test(line.trim()));
  report("AI model", installed ? "PASS" : "WARN", installed ? requiredModel : `${requiredModel} is not installed; run npm run setup:ollama`);
}

const envExists = fs.existsSync(path.join(repositoryRoot, ".env"));
report("Local config", envExists ? "PASS" : "WARN", envExists ? ".env exists" : "run npm run setup to create .env");

try {
  const stats = fs.statfsSync(repositoryRoot);
  const freeGb = (Number(stats.bavail) * Number(stats.bsize)) / (1024 ** 3);
  report("Disk space", freeGb >= 2 ? "PASS" : "WARN", `${freeGb.toFixed(1)} GB free (2 GB recommended; Ollama model needs additional space)`);
} catch {
  report("Disk space", "WARN", "could not read free space on this platform");
}

if (results.every(Boolean)) {
  console.log("[doctor] Ready for local setup.");
} else if (nodeMajor < 22 || !npmVersion || major(npmVersion) < 10) {
  console.error("[doctor] Blocking prerequisite missing. Install the required Node.js/npm versions and rerun.");
  process.exitCode = 1;
} else {
  console.log("[doctor] Local setup can continue. WARN items are optional or have a direct repair command above.");
}
