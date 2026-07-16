import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type OutboundDnsAddress = { address: string; family: 4 | 6 };
export type OutboundDnsResolver = (hostname: string) => Promise<readonly OutboundDnsAddress[]>;

export type OutboundTargetOptions = {
  mode?: "public";
  resolver?: OutboundDnsResolver;
} | {
  mode: "internal";
  allowedHosts: readonly string[];
  allowedPorts?: readonly number[];
  allowHttp?: boolean;
  resolver?: OutboundDnsResolver;
};

export type ValidatedOutboundTarget = {
  url: string;
  hostname: string;
  resolvedAddresses: readonly string[];
};

export type OutboundTargetErrorCode = "INVALID_URL" | "URL_CREDENTIALS" | "PROTOCOL_NOT_ALLOWED" | "HOST_NOT_ALLOWED" | "PORT_NOT_ALLOWED" | "DNS_FAILED" | "UNSAFE_ADDRESS";

export class OutboundTargetError extends Error {
  constructor(public readonly code: OutboundTargetErrorCode, message: string) {
    super(message);
    this.name = "OutboundTargetError";
  }
}

type AddressFamily = "ipv4" | "ipv6";
type Range = readonly [address: string, prefix: number, family: AddressFamily];

function createBlockList(ranges: readonly Range[]) {
  const lists = { ipv4: new BlockList(), ipv6: new BlockList() };
  for (const [address, prefix, family] of ranges) lists[family].addSubnet(address, prefix, family);
  return lists;
}

const privateAddresses = createBlockList([
  ["10.0.0.0", 8, "ipv4"],
  ["172.16.0.0", 12, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["fc00::", 7, "ipv6"],
]);

const nonPublicAddresses = createBlockList([
  ["0.0.0.0", 8, "ipv4"],
  ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"],
  ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"],
  ["192.0.2.0", 24, "ipv4"],
  ["192.88.99.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"],
  ["198.51.100.0", 24, "ipv4"],
  ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"],
  ["240.0.0.0", 4, "ipv4"],
  ["::", 96, "ipv6"],
  ["::ffff:0.0.0.0", 96, "ipv6"],
  ["64:ff9b::", 96, "ipv6"],
  ["64:ff9b:1::", 48, "ipv6"],
  ["100::", 64, "ipv6"],
  ["2001::", 32, "ipv6"],
  ["2001:2::", 48, "ipv6"],
  ["2001:10::", 28, "ipv6"],
  ["2001:20::", 28, "ipv6"],
  ["2001:db8::", 32, "ipv6"],
  ["2002::", 16, "ipv6"],
  ["3fff::", 20, "ipv6"],
  ["fc00::", 7, "ipv6"],
  ["fec0::", 10, "ipv6"],
  ["fe80::", 10, "ipv6"],
  ["ff00::", 8, "ipv6"],
]);

const neverAllowedAddresses = createBlockList([
  ["0.0.0.0", 8, "ipv4"],
  ["100.100.100.200", 32, "ipv4"],
  ["127.0.0.0", 8, "ipv4"],
  ["168.63.129.16", 32, "ipv4"],
  ["169.254.0.0", 16, "ipv4"],
  ["224.0.0.0", 4, "ipv4"],
  ["240.0.0.0", 4, "ipv4"],
  ["::", 96, "ipv6"],
  ["::ffff:0.0.0.0", 96, "ipv6"],
  ["fd00:ec2::254", 128, "ipv6"],
  ["fd20:ce::254", 128, "ipv6"],
  ["fe80::", 10, "ipv6"],
  ["ff00::", 8, "ipv6"],
]);

const metadataHosts = new Set(["instance-data.ec2.internal", "metadata.aws.internal", "metadata.google.internal"]);

const defaultResolver: OutboundDnsResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => {
    if (family !== 4 && family !== 6) throw new Error("Unexpected DNS address family.");
    return { address, family };
  });
};

function stripAddressBrackets(value: string) {
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

function normalizeHostname(value: string) {
  const normalized = stripAddressBrackets(value.trim()).replace(/\.+$/, "").toLowerCase();
  if (!normalized || normalized.includes("%")) throw new OutboundTargetError("HOST_NOT_ALLOWED", "The outbound hostname is not allowed.");
  return normalized;
}

function normalizeAllowedHost(value: string) {
  try {
    const trimmed = value.trim();
    if (!trimmed || /[/?#@]/.test(trimmed)) throw new Error();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) return normalizeHostname(new URL(`https://${trimmed}/`).hostname);
    if (trimmed.includes(":")) throw new OutboundTargetError("HOST_NOT_ALLOWED", "Internal allowlist entries must contain hostnames without ports.");
    return normalizeHostname(new URL(`https://${trimmed}/`).hostname);
  } catch (error) {
    if (error instanceof OutboundTargetError) throw error;
    throw new OutboundTargetError("HOST_NOT_ALLOWED", "The internal host allowlist is invalid.");
  }
}

function addressFamily(address: string) {
  if (address.includes("%")) return undefined;
  const family = isIP(address);
  return family === 4 ? "ipv4" : family === 6 ? "ipv6" : undefined;
}

function addressIsAllowed(address: string, internal: boolean) {
  const family = addressFamily(address);
  if (!family || neverAllowedAddresses[family].check(address, family)) return false;
  if (internal && privateAddresses[family].check(address, family)) return true;
  return !nonPublicAddresses[family].check(address, family);
}

function parseTarget(input: string | URL) {
  try {
    return new URL(input.toString());
  } catch {
    throw new OutboundTargetError("INVALID_URL", "The outbound target must be a valid absolute URL.");
  }
}

export async function validateOutboundTarget(input: string | URL, options: OutboundTargetOptions = {}): Promise<ValidatedOutboundTarget> {
  const target = parseTarget(input);
  const internal = options.mode === "internal";
  const allowedProtocols = internal && options.allowHttp ? new Set(["https:", "http:"]) : new Set(["https:"]);
  if (!allowedProtocols.has(target.protocol)) throw new OutboundTargetError("PROTOCOL_NOT_ALLOWED", "The outbound target must use an allowed secure protocol.");
  if (target.username || target.password) throw new OutboundTargetError("URL_CREDENTIALS", "Credentials are not allowed in outbound target URLs.");

  const hostname = normalizeHostname(target.hostname);
  if (hostname === "localhost" || hostname.endsWith(".localhost") || metadataHosts.has(hostname)) throw new OutboundTargetError("UNSAFE_ADDRESS", "The outbound target resolves to a prohibited network address.");

  if (internal) {
    const allowedHosts = new Set(options.allowedHosts.map(normalizeAllowedHost));
    if (!allowedHosts.has(hostname)) throw new OutboundTargetError("HOST_NOT_ALLOWED", "The internal outbound target is not explicitly allowlisted.");
    const port = target.port ? Number(target.port) : target.protocol === "https:" ? 443 : 80;
    const allowedPorts = options.allowedPorts ?? (options.allowHttp ? [80, 443] : [443]);
    if (!allowedPorts.every((value) => Number.isInteger(value) && value > 0 && value <= 65535) || !allowedPorts.includes(port)) throw new OutboundTargetError("PORT_NOT_ALLOWED", "The internal outbound target port is not explicitly allowlisted.");
  }

  const literalFamily = isIP(hostname);
  let resolved: readonly OutboundDnsAddress[];
  if (literalFamily === 4 || literalFamily === 6) resolved = [{ address: hostname, family: literalFamily }];
  else {
    try {
      resolved = await (options.resolver ?? defaultResolver)(hostname);
    } catch {
      throw new OutboundTargetError("DNS_FAILED", "The outbound target could not be resolved.");
    }
  }

  if (!resolved.length) throw new OutboundTargetError("DNS_FAILED", "The outbound target did not resolve to an address.");
  const addresses = new Set<string>();
  for (const result of resolved) {
    const family = isIP(result.address);
    if ((family !== 4 && family !== 6) || family !== result.family) throw new OutboundTargetError("DNS_FAILED", "The outbound target returned an invalid DNS address.");
    const address = result.address.toLowerCase();
    if (!addressIsAllowed(address, internal)) throw new OutboundTargetError("UNSAFE_ADDRESS", "The outbound target resolves to a prohibited network address.");
    addresses.add(address);
  }

  return Object.freeze({ url: target.toString(), hostname, resolvedAddresses: Object.freeze([...addresses]) });
}
