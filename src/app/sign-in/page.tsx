import { signIn } from "@/app/actions";
import { translate } from "@/lib/i18n";
import { currentLocale } from "@/lib/session";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = await currentLocale();
  const query = await searchParams;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <form className="stack card" action={signIn}>
      <h1>{t("auth.signInTitle")}</h1>
      {query.error === "rate_limited" ? (
        <p className="error">{t("auth.rateLimited")}</p>
      ) : query.error ? (
        <p className="error">{t("auth.badCredentials")}</p>
      ) : null}
      <label>
        {t("auth.email")}
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        {t("auth.password")}
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit">{t("auth.submitSignIn")}</button>
      <p><a href="/reset-password">{t("account.reset")}</a></p>
      <p>{t("auth.needAccount")} <a href="/sign-up">{t("nav.signUp")}</a></p>
    </form>
  );
}
