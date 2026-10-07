import { signUp } from "@/app/actions";
import { translate } from "@/lib/i18n";
import { currentLocale } from "@/lib/session";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const locale = await currentLocale();
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/";
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const error =
    query.error === "email"
      ? t("auth.badEmail")
      : query.error === "password"
        ? t("auth.badPassword")
        : query.error === "taken"
          ? t("auth.emailTaken")
          : query.error === "rate_limited"
            ? t("auth.rateLimited")
            : null;
  return (
    <form className="stack card" action={signUp}>
      <h1>{t("auth.signUpTitle")}</h1>
      <input type="hidden" name="returnTo" value={returnTo} />
      {error ? <p className="error">{error}</p> : null}
      <label>
        {t("auth.email")}
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        {t("auth.password")}
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <p className="help">{t("auth.passwordHelp")}</p>
      <button type="submit">{t("auth.submitSignUp")}</button>
      <p>{t("auth.haveAccount")} <a href="/sign-in">{t("nav.signIn")}</a></p>
    </form>
  );
}
