import { describe, expect, it } from "vitest";
import { scanForMalware } from "@/lib/security/malware";

const enabled = process.env.RUN_CLAMAV_EVAL === "true" && process.env.MALWARE_SCANNER === "clamav";

describe.skipIf(!enabled)("ClamAV streaming integration", () => {
  it("accepts clean content and rejects the standard non-malicious EICAR test signature", async () => {
    await expect(scanForMalware(new TextEncoder().encode("synthetic clean document"))).resolves.toBe("CLEAN");
    const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    await expect(scanForMalware(new TextEncoder().encode(eicar))).rejects.toThrow("rejected by malware scanning");
  });
});
