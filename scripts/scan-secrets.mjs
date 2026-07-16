import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { findSecretCategories } from "./secret-patterns.mjs";

const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings = [];
for (const file of trackedFiles) {
  if (!fs.existsSync(file)) continue;
  const contents = fs.readFileSync(file);
  if (contents.includes(0)) continue;
  contents.toString("utf8").split(/\r?\n/).forEach((line, index) => {
    for (const category of findSecretCategories(line)) findings.push({ file, line: index + 1, category });
  });
}

if (findings.length) {
  console.error("Potential secrets were detected. Values are intentionally redacted:");
  for (const finding of findings) console.error(`${finding.file}:${finding.line} | ${finding.category}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed for ${trackedFiles.length} repository files; no values were printed.`);
}
