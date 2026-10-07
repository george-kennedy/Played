"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  consumeToken,
  createSession,
  createUser,
  deleteSession,
  emailIsValid,
  emailIsVerified,
  findUserByEmail,
  issueToken,
  markEmailVerified,
  passwordIsValid,
  setHeadlineProvince,
  setLocale,
  setPassword,
  setPlace,
  setShareEnabled,
  shareForUser,
  verifyPassword,
} from "@/lib/auth";
import { halifaxToday } from "@/lib/dates";
import {
  applyImport,
  applyManualRound,
  applyMarkToggle,
  applyProviderSync,
  attachUnmatched,
  deleteAccount,
  disconnectProvider,
  getDb,
  rebuildSummary,
} from "@/lib/db";
import { parseBirdiesDownload } from "@/lib/sync";
import { pullGolfCanada, ScoreFeedClosed, type ScoreProvider } from "@/lib/providers";
import { sendMail } from "@/lib/mail";
import { isProvince } from "@/lib/names";
import { placeById } from "@/lib/distance";
import { LOCALE_COOKIE, SESSION_COOKIE, currentUser, sessionCookieOptions } from "@/lib/session";

async function publicOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function deliverLink(input: { to: string; subject: string; text: string; token: string; sentPath: string; linkPath: string }): Promise<never> {
  const origin = await publicOrigin();
  const link = `${origin}${input.linkPath}${input.token}`;
  const sent = await sendMail({ to: input.to, subject: input.subject, text: `${input.text}\n${link}\n` });
  if (sent) redirect(input.sentPath);
  redirect(`${input.linkPath}${input.token}`);
}

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

function signUpError(code: string, returnTo: FormDataEntryValue | null): never {
  const back = safeReturn(returnTo, "");
  const query = new URLSearchParams({ error: code });
  if (back) query.set("returnTo", back);
  redirect(`/sign-up?${query.toString()}`);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const returnTo = formData.get("returnTo");
  if (!emailIsValid(email)) signUpError("email", returnTo);
  if (!passwordIsValid(password)) signUpError("password", returnTo);
  const db = getDb();
  if (findUserByEmail(db, email)) signUpError("taken", returnTo);
  const id = randomUUID();
  createUser(db, { id, email, password, createdAt: new Date().toISOString() });
  rebuildSummary(db, id);
  await signInCookie(id);
  const token = issueToken(db, { userId: id, purpose: "verify" });
  // deliverLink shows the link on screen when Resend is not configured,
  // so signup never dead-ends in a Resend-less environment.
  await deliverLink({
    to: email.trim().toLowerCase(),
    subject: "Confirm your Played account",
    text: "Open this link to confirm your email.",
    token,
    sentPath: safeReturn(returnTo, "/"),
    linkPath: "/verify-email?token=",
  });
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const db = getDb();
  const user = findUserByEmail(db, email);
  if (!user || !verifyPassword(password, user.password_hash)) redirect("/sign-in?error=credentials");
  await signInCookie(user.id);
  redirect("/");
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
  await deliverLink({
    to: user.email,
    subject: "Confirm your Played account",
    text: "Open this link to confirm your email.",
    token,
    sentPath: "/verify-email?sent=1",
    linkPath: "/verify-email?token=",
  });
}

export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const db = getDb();
  const user = findUserByEmail(db, email);
  // Unverified users must be able to reset too: otherwise forgetting a
  // password before verifying leaves no recovery path (can't log in to
  // re-verify, can't reset without verifying).
  if (!user) redirect("/reset-password?sent=1");
  const token = issueToken(db, { userId: user.id, purpose: "reset" });
  await deliverLink({
    to: user.email,
    subject: "Reset your Played password",
    text: "Open this link to choose a new password.",
    token,
    sentPath: "/reset-password?sent=1",
    linkPath: "/reset-password?token=",
  });
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
  redirect(safeReturn(formData.get("returnTo"), "/"));
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
  const returnTo = safeReturn(formData.get("returnTo"), "/");
  if (!user) redirect(`/sign-up?returnTo=${encodeURIComponent(returnTo)}`);
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
  const facilityId = String(formData.get("facilityId") ?? "");
  const returnTo = safeReturn(formData.get("returnTo"), `/courses/${facilityId}`);
  if (!user) redirect(`/sign-up?returnTo=${encodeURIComponent(returnTo)}`);
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
  revalidatePath("/directory");
  revalidatePath(`/courses/${facilityId}`);
  revalidatePath("/season");
  if (!result.ok) {
    const join = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${join}error=${result.reason}`);
  }
  redirect(returnTo);
}

export async function uploadCsv(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
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

type ShareUrls = { url: string; cardUrl: string; storyUrl: string };

export async function shareStatus(): Promise<{ enabled: boolean; urls: ShareUrls | null }> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!emailIsVerified(user)) redirect("/verify-email");
  if (!user.headline_province) redirect("/");
  const share = shareForUser(getDb(), user.id);
  if (!share?.enabled) return { enabled: false, urls: null };
  const origin = await publicOrigin();
  return {
    enabled: true,
    urls: {
      url: `${origin}/share/${share.token}`,
      cardUrl: `${origin}/share/${share.token}/card`,
      storyUrl: `${origin}/share/${share.token}/story`,
    },
  };
}

export async function enableShare(): Promise<ShareUrls> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!emailIsVerified(user)) redirect("/verify-email");
  if (!user.headline_province) redirect("/");
  const token = setShareEnabled(getDb(), user.id, true, new Date().toISOString());
  revalidatePath("/season");
  revalidatePath("/");
  const origin = await publicOrigin();
  return {
    url: `${origin}/share/${token}`,
    cardUrl: `${origin}/share/${token}/card`,
    storyUrl: `${origin}/share/${token}/story`,
  };
}

export async function toggleShare(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!emailIsVerified(user)) redirect("/verify-email");
  if (!user.headline_province) redirect("/");
  const enabled = String(formData.get("enabled") ?? "") === "1";
  setShareEnabled(getDb(), user.id, enabled, new Date().toISOString());
  revalidatePath("/season");
  redirect("/season");
}

function memberIdOk(value: string): boolean {
  return /^[A-Za-z0-9-]{4,32}$/.test(value);
}

function providerOf(value: string): ScoreProvider | null {
  if (value === "golf_canada" || value === "birdies") return value;
  return null;
}

function connectRedirect(result: { added: number; unmatched: number; duplicates: number }): never {
  const params = new URLSearchParams({
    added: String(result.added),
    unmatched: String(result.unmatched),
    duplicates: String(result.duplicates),
  });
  redirect(`/connect?${params.toString()}`);
}

export async function connectGolfCanada(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const memberId = String(formData.get("memberId") ?? "").trim();
  if (String(formData.get("consent") ?? "") !== "yes" || !memberIdOk(memberId)) {
    redirect("/connect?error=generic");
  }
  let failure: "agreement" | "endpoint" | "generic" | null = null;
  let result: { added: number; unmatched: number; duplicates: number } | null = null;
  try {
    const history = await pullGolfCanada(memberId);
    result = applyProviderSync(getDb(), {
      userId: user.id,
      provider: "golf_canada",
      externalId: memberId,
      handicapIndex: history.handicapIndex,
      rounds: history.rounds,
      syncedAt: new Date().toISOString(),
      newId: () => randomUUID(),
    });
  } catch (error) {
    failure = error instanceof ScoreFeedClosed ? error.reason : "generic";
  }
  revalidatePath("/connect");
  revalidatePath("/");
  if (failure || !result) redirect(`/connect?error=${failure ?? "generic"}`);
  connectRedirect(result);
}

export async function uploadBirdies(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_000_000) redirect("/connect?error=bad_file");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    redirect("/connect?error=bad_file");
  }
  const download = parseBirdiesDownload(parsed);
  if (!download) redirect("/connect?error=bad_file");
  const result = applyProviderSync(getDb(), {
    userId: user.id,
    provider: "birdies",
    externalId: download.memberId,
    handicapIndex: download.handicapIndex,
    rounds: download.rounds,
    syncedAt: new Date().toISOString(),
    newId: () => randomUUID(),
  });
  revalidatePath("/connect");
  revalidatePath("/");
  revalidatePath("/season");
  connectRedirect(result);
}

export async function disconnectAccount(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const provider = providerOf(String(formData.get("provider") ?? ""));
  if (!provider) redirect("/connect?error=generic");
  disconnectProvider(getDb(), user.id, provider);
  revalidatePath("/connect");
  redirect("/connect");
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
