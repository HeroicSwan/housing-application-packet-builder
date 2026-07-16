import "server-only";
import crypto from "node:crypto";
import { postSyntheticJson } from "@/lib/security/safe-http";
import { timedConnectionTest, type ConnectionTestResult } from "./types";

export function probeDelivery(config: { type: string; endpoint?: string | null; adapter?: string | null; remoteTestAcknowledged?: boolean }, authToken?: string): Promise<ConnectionTestResult> {
  return timedConnectionTest(async () => {
    if (config.type === "MANUAL") return { status: "SIMULATED", code: "DELIVERY_MANUAL_WORKFLOW", summary: "Manual secure download needs no remote connection; staff procedure remains an organizational check." };
    if (config.type === "EMAIL") return { status: "SIMULATED", code: "DELIVERY_USES_SMTP", summary: "Email delivery uses the separately tested SMTP service." };
    if (config.type === "PORTAL_API" && !config.adapter) return { status: "UNSUPPORTED", code: "PORTAL_ADAPTER_REQUIRED", summary: "This portal has no approved API adapter. Use manual delivery or implement an organization-specific adapter." };
    if (!config.endpoint || !config.remoteTestAcknowledged) return { status: "FAILED", code: "DELIVERY_TEST_NOT_ACKNOWLEDGED", summary: "Confirm that the remote service may create a synthetic connection-test record." };
    try {
      const id = crypto.randomUUID();
      const result = await postSyntheticJson(config.endpoint, { event: "connection_test", synthetic: true, testId: id, reference: "SYNTHETIC-SETUP-TEST", timestamp: new Date().toISOString() }, { headers: { "idempotency-key": `setup:${id}`, ...(authToken ? { authorization: `Bearer ${authToken}` } : {}) }, timeoutMs: 10_000 });
      if (result.status < 200 || result.status >= 300) return { status: "FAILED", code: "DELIVERY_TEST_REJECTED", summary: "The destination rejected the synthetic connection test." };
      return { status: "PASSED", code: "DELIVERY_TEST_ACCEPTED", summary: "The destination accepted one idempotent synthetic connection test; it may retain a test record." };
    } catch {
      return { status: "FAILED", code: "DELIVERY_TEST_UNAVAILABLE", summary: "The destination could not be reached through the safe outbound connection policy." };
    }
  });
}
