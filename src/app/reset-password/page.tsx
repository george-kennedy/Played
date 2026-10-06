import { requestReset, resetPassword } from "@/app/actions";
import { translate } from "@/lib/i18n";
import { currentLocale } from "@/lib/session";
import { headers } from "next/headers";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; sent?: string }>;
}) {
  const locale = await currentLocale();
  const query = await searchParams;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const link = query.token ? `${proto}://${host}/reset-password?token=${query.token}` : "";
  return (
    <div className="stack">
      <h1>{t("auth.resetTitle")}</h1>
      <p className="help">{t("auth.resetHelp")}</p>
      <p className="help">{t("auth.devNotice")}</p>
      {query.error === "invalid" ? <p className="error">{t("auth.resetInvalid")}</p> : null}
      {query.error === "password" ? <p className="error">{t("auth.badPassword")}</p> : null}
      {query.sent ? <p>{t("auth.resetHelp")}</p> : null}
      {query.token ? (
        <form className="stack card" action={resetPassword}>
          <p>
            <span className="muted">{t("season.link")}</span><br />
            <a href={link}>{link}</a>
          </p>
          <p>{t("auth.resetReady")}</p>
          <input type="hidden" name="token" value={query.token} />
          <label>
            {t("auth.resetNewPassword")}
            <input name="password" type="password" minLength={10} autoComplete="new-password" required />
          </label>
          <button type="submit">{t("auth.resetSet")}</button>
        </form>
      ) : (
        <form className="stack card" action={requestReset}>
          <label>
            {t("auth.email")}
            <input name="email" type="email" required />
          </label>
          <button type="submit">{t("auth.resetRequest")}</button>
        </form>
      )}
    </div>
  );
}
