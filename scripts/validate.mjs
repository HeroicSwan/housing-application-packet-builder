import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const startedAt = new Date();
const outputRoot = path.resolve("output", "validation", startedAt.toISOString().replaceAll(":", "-"));
await fs.mkdir(outputRoot, { recursive: true });

const npm = process.execPath;
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run validation through npm: npm run validate");
const checks = [
  ["production-schema", npm, [npmCli, "run", "db:validate:production"]],
  ["secret-scan", npm, [npmCli, "run", "security:secrets"]],
  ["history-secret-scan", npm, [npmCli, "run", "security:history"]],
  ["lint", npm, [npmCli, "run", "lint"]],
  ["typecheck", npm, [npmCli, "run", "typecheck"]],
  ["unit-integration", npm, [npmCli, "test", "--", "--run"]],
  ["synthetic-evaluation", npm, [npmCli, "run", "evaluate"]],
  ["production-build", npm, [npmCli, "run", "build"]],
  ["browser-accessibility", npm, [npmCli, "run", "test:e2e"]],
  ["dependency-audit", npm, [npmCli, "run", "security:dependencies"]]
];

function run(command, args, logPath) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, windowsHide: true, shell: false });
    let output = "";
    child.stdout.on("data", (chunk) => { const value = String(chunk); output += value; process.stdout.write(value); });
    child.stderr.on("data", (chunk) => { const value = String(chunk); output += value; process.stderr.write(value); });
    child.once("error", async (error) => { output += `\n${error.message}\n`; await fs.writeFile(logPath, output); resolve(1); });
    child.once("exit", async (code) => { await fs.writeFile(logPath, output); resolve(code ?? 1); });
  });
}

const results = [];
for (const [id, command, args] of checks) {
  const checkStarted = Date.now();
  console.log(`\n[validate] ${id}`);
  const exitCode = await run(command, args, path.join(outputRoot, `${id}.log`));
  results.push({ id, status: exitCode === 0 ? "PASS" : "FAIL", exitCode, durationMs: Date.now() - checkStarted });
}

const matrix = JSON.parse(await fs.readFile(path.resolve("evaluation", "service-gated-tests.json"), "utf8"));
const blockers = matrix.tests.map((test) => ({ id: test.id, label: test.label, status: "BLOCKED_UNTIL_CONFIGURED", requires: test.requires, owner: test.owner }));
const report = {
  schemaVersion: 1,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  safeChecksPassed: results.every((result) => result.status === "PASS"),
  results,
  externalAndLiveBlockers: blockers,
  verdict: results.every((result) => result.status === "PASS") ? "SAFE_CHECKS_PASS_WITH_EXTERNAL_BLOCKERS" : "SAFE_CHECKS_FAILED"
};
await fs.writeFile(path.join(outputRoot, "validation-report.json"), JSON.stringify(report, null, 2));
const markdown = [
  "# Validation report",
  "",
  `Verdict: **${report.verdict}**`,
  "",
  "## Safe checks",
  "",
  ...results.map((result) => `- ${result.status === "PASS" ? "PASS" : "FAIL"}: ${result.id} (${(result.durationMs / 1000).toFixed(1)}s)`),
  "",
  "## Live and organizational blockers",
  "",
  ...blockers.map((blocker) => `- BLOCKED: ${blocker.label} — requires ${blocker.requires.join(", ")} (owner: ${blocker.owner})`),
  ""
].join("\n");
await fs.writeFile(path.join(outputRoot, "validation-report.md"), markdown);
console.log(`\n[validate] report: ${path.join(outputRoot, "validation-report.md")}`);
process.exit(report.safeChecksPassed ? 0 : 1);
