import "server-only";
import https from "node:https";
import { isIP } from "node:net";
import { OutboundTargetError, validateOutboundTarget, type OutboundDnsResolver } from "./outbound-target";

export type SafeHttpResult = { status: number; requestId?: string };
export type SyntheticConnectionTestBody = {
  event: "connection_test";
  synthetic: true;
  testId: string;
  reference: "SYNTHETIC-SETUP-TEST";
  timestamp: string;
};

export type SafeHttpErrorCode = "INVALID_HEADERS" | "REQUEST_FAILED" | "REQUEST_TIMEOUT" | "RESPONSE_TOO_LARGE" | "SYNTHETIC_BODY_REQUIRED";

export class SafeHttpError extends Error {
  constructor(public readonly code: SafeHttpErrorCode, message: string) {
    super(message);
    this.name = "SafeHttpError";
  }
}

type SafeHttpOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  resolver?: OutboundDnsResolver;
};

const protectedHeaders = new Set(["connection", "content-length", "expect", "host", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
const syntheticKeys = ["event", "reference", "synthetic", "testId", "timestamp"];

function safeHeaders(headers: Record<string, string> = {}) {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const key = name.trim().toLowerCase();
    if (!key || protectedHeaders.has(key) || /[\r\n]/.test(key) || /[\r\n]/.test(value)) throw new SafeHttpError("INVALID_HEADERS", "The outbound request contains a prohibited header.");
    normalized[key] = value;
  }
  return normalized;
}

function safeRequestId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,120}$/.test(value)) return undefined;
  return value;
}

function isSyntheticConnectionTestBody(body: Record<string, unknown>): body is SyntheticConnectionTestBody {
  return JSON.stringify(Object.keys(body).sort()) === JSON.stringify(syntheticKeys)
    && body.event === "connection_test"
    && body.synthetic === true
    && typeof body.testId === "string"
    && body.reference === "SYNTHETIC-SETUP-TEST"
    && typeof body.timestamp === "string";
}

async function postJson(target: string, body: Record<string, unknown>, options: SafeHttpOptions): Promise<SafeHttpResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutError = new SafeHttpError("REQUEST_TIMEOUT", "The outbound request timed out before an outcome was confirmed.");
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const validated = await Promise.race([
      validateOutboundTarget(target, { resolver: options.resolver }),
      new Promise<never>((_resolve, reject) => controller.signal.addEventListener("abort", () => reject(timeoutError), { once: true })),
    ]);
    const address = validated.resolvedAddresses[0];
    const family = isIP(address) as 4 | 6;
    const bytes = Buffer.from(JSON.stringify(body));
    const headers = safeHeaders(options.headers);

    return await new Promise<SafeHttpResult>((resolve, reject) => {
      let settled = false;
      const finish = (result: SafeHttpResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const request = https.request(validated.url, {
        method: "POST",
        agent: false,
        signal: controller.signal,
        headers: { ...headers, "content-type": "application/json", "content-length": String(bytes.length) },
        lookup: (_hostname, _options, callback) => callback(null, address, family),
      }, (response) => {
        let responseBytes = 0;
        response.on("data", (chunk: Buffer) => {
          responseBytes += chunk.length;
          if (responseBytes > 8 * 1024) {
            const error = new SafeHttpError("RESPONSE_TOO_LARGE", "The provider response exceeded the safe metadata limit.");
            fail(error);
            response.destroy(error);
          }
        });
        response.once("error", fail);
        response.once("end", () => finish({ status: response.statusCode ?? 0, requestId: safeRequestId(response.headers["x-request-id"]) }));
      });
      request.once("error", fail);
      request.end(bytes);
    });
  } catch (error) {
    if (error instanceof OutboundTargetError || error instanceof SafeHttpError) throw error;
    if (timedOut || (error instanceof Error && error.name === "AbortError")) throw timeoutError;
    throw new SafeHttpError("REQUEST_FAILED", "The outbound request failed before an outcome was confirmed.");
  } finally {
    clearTimeout(timeout);
  }
}

export function postPinnedJson(target: string, body: Record<string, unknown>, options: SafeHttpOptions = {}) {
  return postJson(target, body, options);
}

export function postSyntheticJson(target: string, body: SyntheticConnectionTestBody, options: SafeHttpOptions = {}) {
  if (!isSyntheticConnectionTestBody(body)) return Promise.reject(new SafeHttpError("SYNTHETIC_BODY_REQUIRED", "Connection tests may send only the fixed synthetic payload."));
  return postJson(target, body, options);
}
