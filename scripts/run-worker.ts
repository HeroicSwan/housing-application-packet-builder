import "dotenv/config";
import { createServer } from "node:http";
import { runWorkerSweep } from "../src/lib/jobs";
import { systemDb } from "../src/lib/db";

async function main() {
  const once = process.argv.includes("--once") || process.env.WORKER_ONCE === "true";
  const pollMs = Math.max(250, Number(process.env.WORKER_POLL_MS ?? 2000));
  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 8787);
  const exitAfterHealthResponse = process.env.DATA_MODE === "synthetic" && process.env.WORKER_EXIT_AFTER_HEALTH_RESPONSE === "true";
  let lastSuccessfulSweepAt: Date | undefined;
  let lastFailureAt: Date | undefined;
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  const healthServer = once ? undefined : createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/health") {
      response.writeHead(404).end();
      return;
    }
    const fresh = lastSuccessfulSweepAt && Date.now() - lastSuccessfulSweepAt.getTime() <= Math.max(30_000, pollMs * 3);
    const healthy = Boolean(fresh && (!lastFailureAt || lastSuccessfulSweepAt! > lastFailureAt));
    response.writeHead(healthy ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: healthy ? "ok" : "unavailable", lastSuccessfulSweepAt: lastSuccessfulSweepAt?.toISOString() ?? null }));
    if (healthy && exitAfterHealthResponse) stopping = true;
  });
  if (healthServer) {
    await new Promise<void>((resolve, reject) => {
      healthServer.once("error", reject);
      healthServer.listen(healthPort, "0.0.0.0", resolve);
    });
    console.log(JSON.stringify({ event: "worker_health_listening", port: healthPort, at: new Date().toISOString() }));
  }
  do {
    try {
      const processed = await runWorkerSweep(`worker-${process.pid}`);
      lastSuccessfulSweepAt = new Date();
      console.log(JSON.stringify({ event: "worker_sweep", processed, at: lastSuccessfulSweepAt.toISOString() }));
    } catch (error) {
      lastFailureAt = new Date();
      console.error(JSON.stringify({ event: "worker_sweep_failed", message: error instanceof Error ? error.name : "UnknownError", at: lastFailureAt.toISOString() }));
      if (once) throw error;
    }
    if (!once && !stopping) await new Promise((resolve) => setTimeout(resolve, pollMs));
  } while (!once && !stopping);
  if (healthServer) await new Promise<void>((resolve, reject) => healthServer.close((error) => error ? reject(error) : resolve()));
  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await systemDb.$disconnect();
  process.exitCode = 1;
});
