import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";

function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

describe("durable worker health", () => {
  it("reports a fresh successful sweep and shuts down cleanly", async () => {
    const runId = `${process.pid}-${Date.now().toString(36)}`;
    const filename = `synthetic-worker-health-${runId}.db`;
    const databasePath = path.resolve("prisma", filename);
    const storagePath = path.resolve(".data", `worker-health-${runId}`);
    const port = await availablePort();
    const environment = {
      ...process.env,
      DATABASE_URL: `file:./${filename}`,
      SYSTEM_DATABASE_URL: "",
      DATA_MODE: "synthetic",
      DOCUMENT_PROCESSOR: "mock",
      ENABLE_DEMO_LOGIN: "true",
      LOCAL_STORAGE_ROOT: `.data/worker-health-${runId}`,
      SESSION_SECRET: "synthetic-worker-health-session-secret-with-32-characters",
      WORKER_HEALTH_PORT: String(port),
      WORKER_POLL_MS: "250",
      WORKER_EXIT_AFTER_HEALTH_RESPONSE: "true",
    };
    fs.closeSync(fs.openSync(databasePath, "w"));
    const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], { cwd: process.cwd(), env: environment, encoding: "utf8" });
    expect(migration.status, migration.stderr || migration.stdout).toBe(0);

    const worker = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/run-worker.ts"], {
      cwd: process.cwd(),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    worker.stdout.on("data", (chunk) => { output += chunk.toString(); });
    worker.stderr.on("data", (chunk) => { output += chunk.toString(); });
    try {
      const deadline = Date.now() + 15_000;
      let response: Response | undefined;
      while (Date.now() < deadline) {
        try {
          response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) });
          if (response.ok) break;
        } catch {
          // The worker may still be starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(response?.status, output).toBe(200);
      await expect(response!.json()).resolves.toMatchObject({ status: "ok" });

      const exited = new Promise<number | null>((resolve) => worker.once("exit", resolve));
      expect(await Promise.race([exited, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 5_000))]), output).toBe(0);
    } finally {
      if (worker.exitCode === null) worker.kill("SIGKILL");
      for (const suffix of ["", "-journal", "-shm", "-wal"]) fs.rmSync(`${databasePath}${suffix}`, { force: true });
      const storageRoot = path.resolve(".data");
      if (storagePath.startsWith(`${storageRoot}${path.sep}`)) fs.rmSync(storagePath, { force: true, recursive: true });
    }
  }, 30_000);
});
