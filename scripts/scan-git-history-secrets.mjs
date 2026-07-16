import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { findSecretCategories } from "./secret-patterns.mjs";

export function scanTextForSecrets(contents) {
  const findings = [];
  contents.split(/\r?\n/).forEach((line, index) => {
    for (const category of findSecretCategories(line)) findings.push({ line: index + 1, category });
  });
  return findings;
}

function git(args, encoding = "utf8") {
  return execFileSync("git", args, { encoding, maxBuffer: 128 * 1024 * 1024 });
}

export function scanGitHistory() {
  const commits = git(["rev-list", "--all"]).trim().split(/\r?\n/).filter(Boolean);
  const findings = [];
  let blobsScanned = 0;

  for (const commit of commits) {
    const entries = git(["ls-tree", "-r", "-z", commit]).split("\0").filter(Boolean);
    for (const entry of entries) {
      const match = /\sblob\s([0-9a-f]+)\t(.+)$/s.exec(entry);
      if (!match) continue;
      const [, blob, path] = match;
      const contents = git(["cat-file", "blob", blob], "buffer");
      if (contents.includes(0)) continue;
      blobsScanned += 1;
      for (const finding of scanTextForSecrets(contents.toString("utf8"))) findings.push({ commit, path, ...finding });
    }
  }

  return { commits: commits.length, blobsScanned, findings };
}

function main() {
  const result = scanGitHistory();
  if (result.findings.length) {
    console.error("Potential secrets were detected in Git history. Values are intentionally redacted:");
    for (const finding of result.findings) console.error(`${finding.commit.slice(0, 12)} ${finding.path}:${finding.line} | ${finding.category}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Git-history secret scan passed for ${result.commits} commit(s) and ${result.blobsScanned} text blob(s); no values were printed.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
