import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const startedAt = new Date();
const outputRoot = path.resolve("output", "validation", startedAt.toISOString().replaceAll(":", "-"));
await fs.mkdir(outputRoot, { recursive: true });

const node = process.execPath;
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run validation through npm: npm run validate");

const checks = [
  ["production-schema", [npmCli, "run", "db:validate:production"], 120_000],
  ["secret-scan", [npmCli, "run", "security:secrets"], 120_000],
  ["history-secret-scan", [npmCli, "run", "security:history"], 300_000],
  ["lint", [npmCli, "run", "lint"], 120_000],
  ["typecheck", [npmCli, "run", "typecheck"], 120_000],
  ["unit-integration", [npmCli, "test", "--", "--run"], 180_000],
  ["gold-standard", [npmCli, "run", "evaluation:gold"], 120_000],
  ["synthetic-evaluation", [npmCli, "run", "evaluate"], 120_000],
  ["production-build", [npmCli, "run", "build"], 240_000],
  ["browser-accessibility", [npmCli, "run", "test:e2e"], 300_000],
  ["dependency-audit", [npmCli, "run", "security:dependencies"], 180_000],
  ["local-ai-contract", [npmCli, "run", "ai:verify"], 600_000],
];

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  else child.kill("SIGTERM");
}

function run(id, args, timeoutMs, logPath) {
  return new Promise((resolve) => {
    const child = spawn(node, args, { cwd: process.cwd(), env: process.env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    const write = (chunk) => { const value = String(chunk); output += value; process.stdout.write(value); };
    child.stdout.on("data", write);
    child.stderr.on("data", write);
    const timer = setTimeout(() => { timedOut = true; output += `\nTimed out after ${Math.round(timeoutMs / 1000)} seconds. Child process tree was terminated.\n`; killTree(child); }, timeoutMs);
    const finish = async (exitCode, signal) => {
      clearTimeout(timer);
      await fs.writeFile(logPath, output);
      resolve({ id, status: exitCode === 0 && !timedOut ? "PASS" : "FAIL", exitCode: exitCode ?? 1, signal: signal ?? null, timedOut, durationMs: Date.now() - started });
    };
    const started = Date.now();
    child.once("error", async (error) => { output += `\n${error.message}\n`; await finish(1, null); });
    child.once("exit", finish);
  });
}

const results = [];
for (const [id, args, timeoutMs] of checks) {
  console.log(`\n[validate] ${id} (timeout ${Math.round(timeoutMs / 1000)}s)`);
  results.push(await run(id, args, timeoutMs, path.join(outputRoot, `${id}.log`)));
}

const matrix = JSON.parse(await fs.readFile(path.resolve("evaluation", "service-gated-tests.json"), "utf8"));
const organizationalIds = new Set(["caseworker-session", "accessibility-manual", "external-reviews"]);
const environmentBlocked = matrix.tests.filter((test) => !organizationalIds.has(test.id)).map((test) => ({ ...test, status: "BLOCKED_UNTIL_CONFIGURED" }));
const organizationalApprovals = matrix.tests.filter((test) => organizationalIds.has(test.id)).map((test) => ({ ...test, status: "REQUIRES_ORGANIZATIONAL_APPROVAL" }));
const failedChecks = results.filter((result) => result.status === "FAIL");
const passedChecks = results.filter((result) => result.status === "PASS");
const report = {
  schemaVersion: 2,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  safeChecksPassed: failedChecks.length === 0,
  passedChecks,
  failedChecks,
  environmentBlocked,
  organizationalApprovals,
  results,
  verdict: failedChecks.length === 0 ? "SAFE_CHECKS_PASS_WITH_EXTERNAL_BLOCKERS" : "SAFE_CHECKS_FAILED",
};
await fs.writeFile(path.join(outputRoot, "validation-report.json"), JSON.stringify(report, null, 2));
const markdown = [
  "# Validation report", "", `Verdict: **${report.verdict}**`, "",
  "## Passed safe checks", "", ...passedChecks.map((result) => `- PASS: ${result.id} (${(result.durationMs / 1000).toFixed(1)}s)`), "",
  "## Failed safe checks", "", ...(failedChecks.length ? failedChecks.map((result) => `- FAIL: ${result.id}${result.timedOut ? " (timed out)" : ""} — see ${result.id}.log` ) : ["- None"]), "",
  "## Environment-blocked checks", "", ...environmentBlocked.map((blocker) => `- BLOCKED: ${blocker.label} — requires ${blocker.requires.join(", ")} (owner: ${blocker.owner})`), "",
  "## Organizational approvals still required", "", ...organizationalApprovals.map((approval) => `- APPROVAL: ${approval.label} — requires ${approval.requires.join(", ")} (owner: ${approval.owner})`), "",
  `Artifacts: ${outputRoot}`,
].join("\n");
await fs.writeFile(path.join(outputRoot, "validation-report.md"), markdown);
console.log(`\n[validate] report: ${path.join(outputRoot, "validation-report.md")}`);
process.exit(report.safeChecksPassed ? 0 : 1);
