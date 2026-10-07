import type Database from "better-sqlite3";

export type RateLimitRule = { limit: number; windowMs: number };

/**
 * Fixed-window rate limits, keyed by "<action>:<client ip>".
 * Auth endpoints get the tightest windows: they are the credential-stuffing
 * and email-bombing surface. signIn is deliberately looser than signUp/reset
 * so a shared office IP is unlikely to lock out legitimate users.
 */
export const RATE_LIMITS = {
  "auth:sign-up": { limit: 5, windowMs: 60 * 60 * 1000 },
  "auth:sign-in": { limit: 20, windowMs: 15 * 60 * 1000 },
  "auth:verify": { limit: 10, windowMs: 60 * 60 * 1000 },
  "auth:verify-link": { limit: 5, windowMs: 60 * 60 * 1000 },
  "auth:reset": { limit: 5, windowMs: 60 * 60 * 1000 },
  "connect:golf-canada": { limit: 10, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/**
 * Fixed-window check backed by the rate_limits table. Returns true when the
 * attempt is allowed (and counted). Expired windows are pruned opportunistically.
 */
export function checkRateLimit(
  db: Database.Database,
  key: string,
  rule: RateLimitRule,
  now: number,
): boolean {
  db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(now);
  const row = db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").get(key) as
    | { count: number; reset_at: number }
    | undefined;
  if (!row || row.reset_at <= now) {
    db.prepare(
      "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at",
    ).run(key, now + rule.windowMs);
    return true;
  }
  if (row.count < rule.limit) {
    db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    return true;
  }
  return false;
}
