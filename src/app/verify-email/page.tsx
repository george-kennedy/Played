import { newVerificationLink, verifyEmail } from "@/app/actions";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (user.email_verified_at) redirect("/");
  const locale = await currentLocale();
  const query = await searchParams;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const link = query.token ? `${proto}://${host}/verify-email?token=${query.token}` : "";
  return (
    <div className="stack card">
      <h1>{t("auth.verifyTitle")}</h1>
      <p>{t("auth.verifyHelp")}</p>
      <p className="help">{t("auth.devNotice")}</p>
      {query.error ? <p className="error">{t("auth.resetInvalid")}</p> : null}
      {link ? (
        <form className="stack" action={verifyEmail}>
          <p>
            <span className="muted">{t("auth.verifyLinkLabel")}</span><br />
            <a href={link}>{link}</a>
          </p>
          <input type="hidden" name="token" value={query.token} />
          <button type="submit">{t("auth.verifyButton")}</button>
        </form>
      ) : (
        <form action={newVerificationLink}>
          <button type="submit">{t("auth.newLink")}</button>
        </form>
      )}
    </div>
  );
}
