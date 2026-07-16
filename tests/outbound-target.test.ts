import { describe, expect, it, vi } from "vitest";
import { OutboundTargetError, type OutboundDnsResolver, validateOutboundTarget } from "@/lib/security/outbound-target";

function resolver(addresses: string[]): OutboundDnsResolver {
  return vi.fn(async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 as const : 4 as const })));
}

describe("public outbound targets", () => {
  it("accepts HTTPS only after every DNS answer is globally routable", async () => {
    const resolve = resolver(["93.184.216.34", "2606:4700:4700::1111"]);
    await expect(validateOutboundTarget("https://api.housing-provider.example/v1", { resolver: resolve })).resolves.toEqual({
      url: "https://api.housing-provider.example/v1",
      hostname: "api.housing-provider.example",
      resolvedAddresses: ["93.184.216.34", "2606:4700:4700::1111"],
    });
    expect(resolve).toHaveBeenCalledWith("api.housing-provider.example");
  });

  it("rejects HTTP and URL credentials before DNS resolution", async () => {
    const resolve = resolver(["93.184.216.34"]);
    await expect(validateOutboundTarget("http://api.example.test", { resolver: resolve })).rejects.toMatchObject({ code: "PROTOCOL_NOT_ALLOWED" });
    await expect(validateOutboundTarget("https://setup-user:setup-password@api.example.test", { resolver: resolve })).rejects.toMatchObject({ code: "URL_CREDENTIALS" });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "100.100.100.200",
    "127.0.0.1",
    "169.254.169.254",
    "172.31.255.255",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "::",
    "::1",
    "::ffff:8.8.8.8",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "2001:db8::1",
    "2002:a00:1::",
    "fc00::1",
    "fd00:ec2::254",
    "fe80::1",
    "ff00::1",
  ])("rejects a DNS answer in a prohibited range: %s", async (address) => {
    await expect(validateOutboundTarget("https://resolved.example.test", { resolver: resolver([address]) })).rejects.toMatchObject({ code: "UNSAFE_ADDRESS" });
  });

  it.each([
    "https://127.1/",
    "https://2130706433/",
    "https://0x7f000001/",
    "https://[::ffff:7f00:1]/",
  ])("rejects alternate literal address encoding: %s", async (target) => {
    const resolve = vi.fn<OutboundDnsResolver>();
    await expect(validateOutboundTarget(target, { resolver: resolve })).rejects.toMatchObject({ code: "UNSAFE_ADDRESS" });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects mixed public and private DNS answers", async () => {
    await expect(validateOutboundTarget("https://mixed.example.test", { resolver: resolver(["93.184.216.34", "10.0.0.5"]) })).rejects.toMatchObject({ code: "UNSAFE_ADDRESS" });
  });

  it("returns a redacted DNS failure instead of resolver details", async () => {
    const secretCanary = "dns-secret-canary";
    const promise = validateOutboundTarget("https://missing.example.test", { resolver: async () => { throw new Error(secretCanary); } });
    await expect(promise).rejects.toMatchObject({ code: "DNS_FAILED" });
    await expect(promise).rejects.not.toThrow(secretCanary);
  });
});

describe("internal outbound targets", () => {
  it("allows an explicitly named deployment service on an explicitly allowed HTTP port", async () => {
    await expect(validateOutboundTarget("http://OBJECT-STORAGE.internal:9000/health", {
      mode: "internal",
      allowedHosts: ["object-storage.internal."],
      allowedPorts: [9000],
      allowHttp: true,
      resolver: resolver(["10.20.30.40"]),
    })).resolves.toMatchObject({ hostname: "object-storage.internal", resolvedAddresses: ["10.20.30.40"] });
  });

  it("rejects an internal host or port that was not explicitly allowlisted", async () => {
    await expect(validateOutboundTarget("https://other.internal", {
      mode: "internal",
      allowedHosts: ["worker.internal"],
      resolver: resolver(["10.20.30.40"]),
    })).rejects.toMatchObject({ code: "HOST_NOT_ALLOWED" });
    await expect(validateOutboundTarget("https://worker.internal:8443", {
      mode: "internal",
      allowedHosts: ["worker.internal"],
      resolver: resolver(["10.20.30.40"]),
    })).rejects.toMatchObject({ code: "PORT_NOT_ALLOWED" });
  });

  it.each(["127.0.0.1", "169.254.169.254", "100.100.100.200", "168.63.129.16", "::ffff:10.0.0.1", "fd00:ec2::254", "fe80::1"])("still rejects loopback, link-local, mapped, or metadata address %s", async (address) => {
    await expect(validateOutboundTarget("https://service.internal", {
      mode: "internal",
      allowedHosts: ["service.internal"],
      resolver: resolver([address]),
    })).rejects.toMatchObject({ code: "UNSAFE_ADDRESS" });
  });

  it("rejects known metadata hostnames even when explicitly allowlisted", async () => {
    await expect(validateOutboundTarget("https://metadata.google.internal", {
      mode: "internal",
      allowedHosts: ["metadata.google.internal"],
      resolver: resolver(["10.20.30.40"]),
    })).rejects.toMatchObject({ code: "UNSAFE_ADDRESS" });
  });
});

it("uses fixed, non-sensitive validation errors", () => {
  const error = new OutboundTargetError("INVALID_URL", "The outbound target is invalid.");
  expect(error).toMatchObject({ name: "OutboundTargetError", code: "INVALID_URL" });
});
