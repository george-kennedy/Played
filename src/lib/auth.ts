import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import type { UserRow } from "./db";
import type { Province } from "./types";

const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const current = Buffer.from(hash, "hex");
  if (current.length !== next.length) return false;
  return timingSafeEqual(current, next);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

export function passwordIsValid(password: string): boolean {
  return password.length >= 10;
}

export function emailIsValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createUser(
  db: Database.Database,
  input: { id: string; email: string; password: string; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, email_verified_at, headline_province, locale, place_id, created_at)
     VALUES (?, ?, ?, NULL, NULL, 'en', NULL, ?)`,
  ).run(input.id, input.email.trim().toLowerCase(), hashPassword(input.password), input.createdAt);
}

export function findUserByEmail(db: Database.Database, email: string): UserRow | null {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()) as UserRow | undefined;
  return row ?? null;
}

export function findUserById(db: Database.Database, id: string): UserRow | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ?? null;
}

export function createSession(db: Database.Database, userId: string, now = new Date()): string {
  const token = randomToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), userId, expires);
  return token;
}

export function userForSession(db: Database.Database, token: string | undefined, now = new Date()): UserRow | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(sha256(token), now.toISOString()) as UserRow | undefined;
  return row ?? null;
}

export function deleteSession(db: Database.Database, token: string | undefined): void {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function issueToken(
  db: Database.Database,
  input: { userId: string; purpose: "verify" | "reset"; now?: Date },
): string {
  const now = input.now ?? new Date();
  const hours = input.purpose === "verify" ? 24 * 7 : 2;
  const expires = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  const token = randomToken();
  db.prepare("DELETE FROM tokens WHERE user_id = ? AND purpose = ?").run(input.userId, input.purpose);
  db.prepare("INSERT INTO tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)").run(
    sha256(token),
    input.userId,
    input.purpose,
    expires,
  );
  return token;
}

export function consumeToken(
  db: Database.Database,
  input: { token: string; purpose: "verify" | "reset"; now?: Date },
): string | null {
  const now = input.now ?? new Date();
  const row = db
    .prepare("SELECT user_id, expires_at FROM tokens WHERE token_hash = ? AND purpose = ?")
    .get(sha256(input.token), input.purpose) as { user_id: string; expires_at: string } | undefined;
  if (!row || row.expires_at <= now.toISOString()) return null;
  db.prepare("DELETE FROM tokens WHERE token_hash = ?").run(sha256(input.token));
  return row.user_id;
}

export function markEmailVerified(db: Database.Database, userId: string, at: string): void {
  db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(at, userId);
}

export function setPassword(db: Database.Database, userId: string, password: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
}

export function setHeadlineProvince(db: Database.Database, userId: string, province: Province): void {
  db.prepare("UPDATE users SET headline_province = ? WHERE id = ?").run(province, userId);
}

export function setLocale(db: Database.Database, userId: string, locale: "en" | "fr"): void {
  db.prepare("UPDATE users SET locale = ? WHERE id = ?").run(locale, userId);
}

export function setPlace(db: Database.Database, userId: string, placeId: string | null): void {
  db.prepare("UPDATE users SET place_id = ? WHERE id = ?").run(placeId, userId);
}

export function setShareEnabled(db: Database.Database, userId: string, enabled: boolean, now: string): string {
  const existing = db.prepare("SELECT token FROM share_links WHERE user_id = ?").get(userId) as { token: string } | undefined;
  const token = existing?.token ?? randomToken();
  db.prepare(
    `INSERT INTO share_links (user_id, token, enabled, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled`,
  ).run(userId, token, enabled ? 1 : 0, now);
  return token;
}

export function shareForUser(db: Database.Database, userId: string): { token: string; enabled: boolean } | null {
  const row = db.prepare("SELECT token, enabled FROM share_links WHERE user_id = ?").get(userId) as
    | { token: string; enabled: number }
    | undefined;
  if (!row) return null;
  return { token: row.token, enabled: row.enabled === 1 };
}

export function shareByToken(db: Database.Database, token: string): { userId: string; enabled: boolean } | null {
  const row = db.prepare("SELECT user_id, enabled FROM share_links WHERE token = ?").get(token) as
    | { user_id: string; enabled: number }
    | undefined;
  if (!row) return null;
  return { userId: row.user_id, enabled: row.enabled === 1 };
}
