"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  consumeToken,
  createSession,
  createUser,
  deleteSession,
  emailIsValid,
  findUserByEmail,
  issueToken,
  markEmailVerified,
  passwordIsValid,
  setHeadlineProvince,
  setLocale,
  setPassword,
  setPlace,
  setShareEnabled,
  verifyPassword,
} from "@/lib/auth";
import { halifaxToday } from "@/lib/dates";
import {
  applyImport,
  applyManualRound,
  applyMarkToggle,
  attachUnmatched,
  deleteAccount,
  getDb,
  rebuildSummary,
} from "@/lib/db";
import { isProvince } from "@/lib/names";
import { placeById } from "@/lib/distance";
import { LOCALE_COOKIE, SESSION_COOKIE, currentUser, sessionCookieOptions } from "@/lib/session";

function safeReturn(value: FormDataEntryValue | null, fallback: string): string {
  const text = String(value ?? "");
  if (text.startsWith("/") && !text.startsWith("//") && !text.startsWith("/\\")) return text;
  return fallback;
}

async function signInCookie(userId: string) {
  const token = createSession(getDb(), userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!emailIsValid(email)) redirect("/sign-up?error=email");
  if (!passwordIsValid(password)) redirect("/sign-up?error=password");
  const db = getDb();
  if (findUserByEmail(db, email)) redirect("/sign-up?error=taken");
  const id = randomUUID();
  createUser(db, { id, email, password, createdAt: new Date().toISOString() });
  rebuildSummary(db, id);
  await signInCookie(id);
  const token = issueToken(db, { userId: id, purpose: "verify" });
  redirect(`/verify-email?token=${token}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const db = getDb();
  const user = findUserByEmail(db, email);
  if (!user || !verifyPassword(password, user.password_hash)) redirect("/sign-in?error=credentials");
  await signInCookie(user.id);
  redirect(user.email_verified_at ? (user.headline_province ? "/" : "/") : "/verify-email");
}

export async function signOut() {
  const jar = await cookies();
  deleteSession(getDb(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export async function verifyEmail(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const db = getDb();
  const userId = consumeToken(db, { token, purpose: "verify" });
  if (!userId) redirect("/verify-email?error=invalid");
  markEmailVerified(db, userId, new Date().toISOString());
  redirect("/");
}

export async function newVerificationLink() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (user.email_verified_at) redirect("/");
  const token = issueToken(getDb(), { userId: user.id, purpose: "verify" });
  redirect(`/verify-email?token=${token}`);
}

export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const db = getDb();
  const user = findUserByEmail(db, email);
  if (!user) redirect("/reset-password?sent=1");
  const token = issueToken(db, { userId: user.id, purpose: "reset" });
  redirect(`/reset-password?token=${token}`);
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!passwordIsValid(password)) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=password`);
  const db = getDb();
  const userId = consumeToken(db, { token, purpose: "reset" });
  if (!userId) redirect("/reset-password?error=invalid");
  setPassword(db, userId, password);
  await signInCookie(userId);
  redirect("/");
}

export async function chooseProvince(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const province = String(formData.get("province") ?? "");
  if (!isProvince(province)) redirect("/?error=province");
  setHeadlineProvince(getDb(), user.id, province);
  revalidatePath("/");
  redirect("/");
}

export async function chooseLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  if (locale !== "en" && locale !== "fr") return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { ...sessionCookieOptions(), httpOnly: false });
  const user = await currentUser();
  if (user) setLocale(getDb(), user.id, locale);
  const returnTo = safeReturn(formData.get("returnTo"), "/");
  revalidatePath("/", "layout");
  redirect(returnTo);
}

export async function setPlayed(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const returnTo = safeReturn(formData.get("returnTo"), "/");
  if (!user.email_verified_at) redirect(`/verify-email?error=required`);
  const facilityId = String(formData.get("facilityId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  applyMarkToggle(getDb(), {
    userId: user.id,
    facilityId,
    turnOn: intent !== "off",
    today: halifaxToday(),
    newId: randomUUID(),
  });
  revalidatePath("/");
  revalidatePath("/directory");
  revalidatePath(`/courses/${facilityId}`);
  revalidatePath("/season");
  redirect(returnTo);
}

export async function addRound(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.email_verified_at) redirect("/verify-email?error=required");
  const facilityId = String(formData.get("facilityId") ?? "");
  const result = applyManualRound(getDb(), {
    userId: user.id,
    facilityId,
    playedOn: String(formData.get("playedOn") ?? ""),
    holes: String(formData.get("holes") ?? ""),
    scoreRaw: String(formData.get("score") ?? ""),
    today: halifaxToday(),
    newId: randomUUID(),
  });
  revalidatePath("/");
  revalidatePath(`/courses/${facilityId}`);
  revalidatePath("/season");
  if (!result.ok) redirect(`/courses/${facilityId}?error=${result.reason}`);
  redirect(`/courses/${facilityId}`);
}

export async function uploadCsv(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.email_verified_at) redirect("/verify-email?error=required");
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/import?error=file");
  const csv = await file.text();
  let counter = 0;
  applyImport(getDb(), {
    userId: user.id,
    csv,
    newId: () => `imp-${randomUUID()}-${counter++}`,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath("/import");
  revalidatePath("/directory");
  revalidatePath("/season");
  redirect("/import");
}

export async function attachRow(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.email_verified_at) redirect("/verify-email?error=required");
  const result = attachUnmatched(getDb(), {
    userId: user.id,
    roundId: String(formData.get("roundId") ?? ""),
    facilityId: String(formData.get("facilityId") ?? ""),
  });
  revalidatePath("/import");
  revalidatePath("/");
  if (!result.ok) redirect(`/import?error=${result.reason}`);
  redirect("/import");
}

export async function savePlace(formData: FormData) {
  const user = await currentUser();
  const place = placeById(String(formData.get("place") ?? ""));
  const returnTo = safeReturn(formData.get("returnTo"), "/directory");
  if (user && place) setPlace(getDb(), user.id, place.id);
  redirect(returnTo);
}

export async function toggleShare(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.headline_province) redirect("/");
  const enabled = String(formData.get("enabled") ?? "") === "1";
  setShareEnabled(getDb(), user.id, enabled, new Date().toISOString());
  revalidatePath("/season");
  redirect("/season");
}

export async function removeAccount(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (String(formData.get("confirm") ?? "") !== "DELETE") redirect("/account?error=confirm");
  const jar = await cookies();
  deleteAccount(getDb(), user.id);
  jar.delete(SESSION_COOKIE);
  redirect("/");
}
