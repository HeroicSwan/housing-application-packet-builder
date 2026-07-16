import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveE2eDatabaseUrl } from "./e2e-database.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl || process.env.DATABASE_URL !== databaseUrl) {
  throw new Error("The Playwright server requires matching guarded E2E database settings.");
}
resolveE2eDatabaseUrl(repositoryRoot, databaseUrl);
if (process.env.DATA_MODE !== "synthetic") throw new Error("The Playwright server requires DATA_MODE=synthetic.");

const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const port = process.env.E2E_PORT ?? "3100";
const child = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", port], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (child.exitCode === null) child.kill(signal);
  });
}

child.once("error", (error) => {
  console.error(`[e2e] Next.js server failed to start (${error.code ?? "unknown error"}).`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
