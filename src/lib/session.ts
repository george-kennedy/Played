import { cookies } from "next/headers";
import { userForSession } from "./auth";
import { getDb, type UserRow } from "./db";
import type { Locale } from "./i18n";

export const SESSION_COOKIE = "played_session";
export const LOCALE_COOKIE = "played_locale";

export async function currentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  return userForSession(getDb(), jar.get(SESSION_COOKIE)?.value);
}

export async function currentLocale(): Promise<Locale> {
  const jar = await cookies();
  const cookie = jar.get(LOCALE_COOKIE)?.value;
  if (cookie === "fr" || cookie === "en") return cookie;
  const user = await currentUser();
  return user?.locale === "fr" ? "fr" : "en";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
