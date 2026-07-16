import "server-only";
import crypto from "node:crypto";
import { collectMetrics } from "@/lib/monitoring/metrics";
import { postSyntheticJson } from "@/lib/security/safe-http";
import { timedConnectionTest, type ConnectionTestResult } from "./types";

export function probeMonitoring(endpoint?: string | null, token?: string): Promise<ConnectionTestResult> {
  return timedConnectionTest(async () => {
    await collectMetrics();
    if (!endpoint) return { status: "SIMULATED", code: "MONITORING_COLLECTOR_ONLY", summary: "The local metrics collector works, but no external alert receiver was tested." };
    try {
      const result = await postSyntheticJson(endpoint, { event: "connection_test", synthetic: true, testId: crypto.randomUUID(), reference: "SYNTHETIC-SETUP-TEST", timestamp: new Date().toISOString() }, { headers: token ? { authorization: `Bearer ${token}` } : undefined, timeoutMs: 5_000 });
      if (result.status < 200 || result.status >= 300) return { status: "FAILED", code: "MONITORING_RECEIVER_REJECTED", summary: "The external monitoring receiver did not accept the synthetic event." };
      return { status: "PASSED", code: "MONITORING_RECEIVER_OK", summary: "The metrics collector and external synthetic alert receiver were verified." };
    } catch {
      return { status: "FAILED", code: "MONITORING_RECEIVER_UNAVAILABLE", summary: "The external monitoring receiver could not be reached safely." };
    }
  });
}
