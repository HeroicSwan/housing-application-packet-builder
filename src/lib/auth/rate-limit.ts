import { systemDb } from "@/lib/db";
import { sha256 } from "@/lib/security/encryption";

export async function checkRateLimit(key: string, limit = 8, windowMs = 60_000) {
  const bucketKey = sha256(key);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    const current = await systemDb.rateLimitBucket.findUnique({ where: { key: bucketKey } });
    if (!current) {
      try {
        await systemDb.rateLimitBucket.create({ data: { key: bucketKey, count: 1, resetAt: new Date(now.getTime() + windowMs) } });
        return true;
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "P2002")) throw error;
        continue;
      }
    }
    if (current.resetAt <= now) {
      const reset = await systemDb.rateLimitBucket.updateMany({ where: { key: bucketKey, resetAt: current.resetAt }, data: { count: 1, resetAt: new Date(now.getTime() + windowMs) } });
      if (reset.count === 1) return true;
      continue;
    }
    if (current.count >= limit) return false;
    const increment = await systemDb.rateLimitBucket.updateMany({ where: { key: bucketKey, resetAt: current.resetAt, count: { lt: limit } }, data: { count: { increment: 1 } } });
    if (increment.count === 1) return true;
  }
  return false;
}
