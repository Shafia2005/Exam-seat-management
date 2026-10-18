// Fixed-window rate limiter for brute-force protection on auth routes.
// Counters live in PostgreSQL, so every app instance shares the same limits.

import { prisma } from '@/lib/prisma'
import { ApiError } from './http'

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/** Counts one attempt for `key` and reports whether it is within `limit` per `windowMs`. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(windowMs / 1000)

  // One atomic statement: start a new window if the old one expired, otherwise increment.
  const [row] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, NOW() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `

  // Occasionally prune expired windows so the table stays small.
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } })
  }

  return {
    allowed: row.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  }
}

/** Like `consumeRateLimit`, but throws a 429 with `message` once the limit is exceeded. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number, message: string): Promise<void> {
  const result = await consumeRateLimit(key, limit, windowMs)
  if (!result.allowed) {
    const minutes = Math.ceil(result.retryAfterSeconds / 60)
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', `${message} Try again in ${minutes} minute(s).`)
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } })
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}
