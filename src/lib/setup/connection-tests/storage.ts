import "server-only";
import crypto from "node:crypto";
import { createStorage, type StorageConfig } from "@/lib/storage";
import { sha256 } from "@/lib/security/encryption";
import { timedConnectionTest, type ConnectionTestResult } from "./types";

export function probeStorage(config: StorageConfig, prefix = "setup-tests", timeoutMs = 15_000): Promise<ConnectionTestResult> {
  return timedConnectionTest(async () => {
    const storage = createStorage(config);
    const key = `${prefix}/${crypto.randomUUID()}.synthetic`;
    const payload = crypto.randomBytes(48);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let wrote = false;
    try {
      await storage.put(key, payload, "application/octet-stream", controller.signal);
      wrote = true;
      const read = await storage.get(key, controller.signal);
      if (sha256(read) !== sha256(payload)) return { status: "FAILED", code: "STORAGE_CONTENT_MISMATCH", summary: "The temporary object was read back with different content." };
      await storage.delete(key, controller.signal);
      wrote = false;
      try {
        await storage.get(key, controller.signal);
        return { status: "FAILED", code: "STORAGE_DELETE_NOT_CONFIRMED", summary: "The temporary object still existed after deletion." };
      } catch {
        return { status: "PASSED", code: "STORAGE_ROUND_TRIP_OK", summary: "A temporary encrypted synthetic object was written, verified, and deleted." };
      }
    } catch (error) {
      return { status: "FAILED", code: error instanceof Error && error.name === "AbortError" ? "STORAGE_TIMEOUT" : "STORAGE_UNAVAILABLE", summary: "The temporary storage round trip did not complete." };
    } finally {
      clearTimeout(timeout);
      if (wrote) {
        try { await storage.delete(key, AbortSignal.timeout(5_000)); } catch { /* result remains failed and no sensitive details are retained */ }
      }
      storage.destroy();
    }
  });
}
