import { db } from "@/lib/db";

export async function checkRateLimit(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const current = await db.rateLimitBucket.findUnique({ where: { key } });
  if (!current || current.resetAt.getTime() <= now) {
    await db.rateLimitBucket.upsert({ where: { key }, create: { key, count: 1, resetAt: new Date(now + windowMs) }, update: { count: 1, resetAt: new Date(now + windowMs) } });
    return true;
  }
  if (current.count >= limit) return false;
  await db.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}
