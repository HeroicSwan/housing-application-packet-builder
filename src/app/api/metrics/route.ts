import crypto from "node:crypto";
import { env } from "@/lib/env";
import { collectMetrics, renderPrometheusMetrics } from "@/lib/monitoring/metrics";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  if (!env.MONITORING_TOKEN) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(env.MONITORING_TOKEN);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized\n", { status: 401, headers: { "cache-control": "no-store" } });
  const body = renderPrometheusMetrics(await collectMetrics());
  return new Response(body, { headers: { "content-type": "text/plain; version=0.0.4", "cache-control": "no-store" } });
}
