import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { calculateEvaluationMetrics } from "../src/lib/evaluation/metrics";
import { runDeterministicWorkload } from "../src/lib/evaluation/deterministic";

type Rule = { minimum?: number; maximum?: number };

async function main() {
  const started = new Date();
  const cases = runDeterministicWorkload(120);
  const metrics = calculateEvaluationMetrics(cases);
  const thresholds = JSON.parse(await fs.readFile("evaluation/thresholds.json", "utf8")) as { deterministic: Record<string, Rule> };
  const checks = Object.entries(thresholds.deterministic).map(([metric, rule]) => {
    const value = Number(metrics[metric as keyof typeof metrics]);
    const passed = (rule.minimum === undefined || value >= rule.minimum) && (rule.maximum === undefined || value <= rule.maximum);
    return { metric, value, ...rule, passed };
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join("output", "evaluations", timestamp);
  const report = {
    schemaVersion: 1,
    syntheticOnly: true,
    mode: "deterministic",
    adapter: "deterministic-v1",
    provider: "none",
    model: "none",
    extractionStrategyVersion: "labeled-synthetic-v1",
    startedAt: started.toISOString(),
    completedAt: new Date().toISOString(),
    workload: { applicants: 120, scenarios: [...new Set(cases.map((item) => item.scenario))] },
    metrics,
    checks,
    blockedLiveTests: ["Approved provider/model quality evaluation requires explicit credentials, vendor approval, and RUN_LIVE_EVALUATION opt-in."],
    result: checks.every((check) => check.passed) ? "PASSED" : "FAILED",
  };

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  const rows = checks.map((check) => `<tr><td>${check.metric}</td><td>${check.value}</td><td>${check.minimum ?? "&mdash;"}</td><td>${check.maximum ?? "&mdash;"}</td><td>${check.passed ? "PASS" : "FAIL"}</td></tr>`).join("");
  await fs.writeFile(path.join(directory, "report.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>HAPB synthetic evaluation</title><style>body{font:15px system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#15263b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d7e0e8;padding:9px;text-align:left}th{background:#edf2f7}.warning{border-left:4px solid #b7791f;padding:12px;background:#fffaf0}</style><h1>Housing Application Packet Builder evaluation</h1><p class="warning"><strong>Synthetic deterministic mode.</strong> No live provider was called and this report does not authorize real applicant data.</p><p>Result: <strong>${report.result}</strong> &middot; Applicants: 120 &middot; Scenarios: ${report.workload.scenarios.length}</p><table><thead><tr><th>Metric</th><th>Value</th><th>Minimum</th><th>Maximum</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table><h2>Blocked live tests</h2><p>${report.blockedLiveTests[0]}</p></html>`);
  console.log(JSON.stringify({ event: "evaluation_completed", result: report.result, applicants: 120, reportDirectory: directory }));
  if (report.result !== "PASSED") process.exitCode = 1;
}

void main();
