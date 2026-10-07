import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./db";
import { checkRateLimit, RATE_LIMITS } from "./rate-limit";

const opened: Array<{ close: () => void }> = [];

function database() {
  const dir = mkdtempSync(path.join(tmpdir(), "played-rl-"));
  const db = openDatabase(path.join(dir, "test.sqlite"));
  opened.push(db);
  return db;
}

afterEach(() => {
  for (const db of opened) db.close();
  opened.length = 0;
});

describe("checkRateLimit", () => {
  it("allows up to the limit, then blocks until the window resets", () => {
    const db = database();
    const rule = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit(db, "k", rule, 0)).toBe(true);
    expect(checkRateLimit(db, "k", rule, 1)).toBe(true);
    expect(checkRateLimit(db, "k", rule, 2)).toBe(true);
    expect(checkRateLimit(db, "k", rule, 3)).toBe(false);
    expect(checkRateLimit(db, "k", rule, 4)).toBe(false);
    // Window expired: the count starts over.
    expect(checkRateLimit(db, "k", rule, 60_001)).toBe(true);
    expect(checkRateLimit(db, "k", rule, 60_002)).toBe(true);
  });

  it("tracks keys independently", () => {
    const db = database();
    const rule = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(db, "a", rule, 0)).toBe(true);
    expect(checkRateLimit(db, "a", rule, 1)).toBe(false);
    expect(checkRateLimit(db, "b", rule, 1)).toBe(true);
  });

  it("prunes expired windows", () => {
    const db = database();
    const rule = { limit: 1, windowMs: 60_000 };
    checkRateLimit(db, "old", rule, 0);
    expect(
      (db.prepare("SELECT COUNT(*) AS n FROM rate_limits").get() as { n: number }).n,
    ).toBe(1);
    checkRateLimit(db, "new", rule, 120_000);
    expect(
      (db.prepare("SELECT COUNT(*) AS n FROM rate_limits").get() as { n: number }).n,
    ).toBe(1);
  });

  it("defines sane rules for the auth actions", () => {
    expect(RATE_LIMITS["auth:sign-up"].limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS["auth:reset"].limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS["auth:sign-in"].windowMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
