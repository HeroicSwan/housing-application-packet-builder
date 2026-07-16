import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const matrix = JSON.parse(await fs.readFile("evaluation/service-gated-tests.json", "utf8"));
const id = process.argv.find((value) => value.startsWith("--id="))?.slice(5);
if (!id) {
  console.log("Live checks are never run by default. Select one explicitly with --id=<id> after configuring its prerequisites.\n");
  for (const test of matrix.tests) console.log(`${test.id}: ${test.label}\n  requires: ${test.requires.join(", ")}\n  command: ${test.command}`);
  process.exit(0);
}
const selected = matrix.tests.find((test) => test.id === id);
if (!selected) throw new Error(`Unknown service-gated test: ${id}`);
if (selected.command.startsWith("manual ") || selected.command === "organizational review") throw new Error(`${selected.label} is a manual or organizational gate and cannot be automated.`);
console.log(`Running service-gated check: ${selected.label}\nPrerequisites: ${selected.requires.join(", ")}`);
const child = spawn(selected.command, { cwd: process.cwd(), env: process.env, shell: true, stdio: "inherit", windowsHide: true });
process.exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1)); });
