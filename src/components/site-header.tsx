import { chooseLocale, signOut } from "@/app/actions";
import { translate, type Locale } from "@/lib/i18n";
import type { UserRow } from "@/lib/db";

export function SiteHeader({
  locale,
  user,
  path,
}: {
  locale: Locale;
  user: UserRow | null;
  path: string;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <header className="site-header">
      <a className="brand" href="/">{t("brand")}</a>
      <nav className="nav" aria-label={t("brand")}>
        <a href="/">{t("nav.home")}</a>
        <a href="/directory">{t("nav.directory")}</a>
        {user ? <a href="/import">{t("nav.import")}</a> : null}
        {user ? <a href="/season">{t("nav.season")}</a> : null}
        {user ? <a href="/account">{t("nav.account")}</a> : null}
        {user ? null : <a href="/sign-in">{t("nav.signIn")}</a>}
      </nav>
      <form className="lang" action={chooseLocale}>
        <input type="hidden" name="returnTo" value={path} />
        <span className="sr">{t("lang.switch")}</span>
        <button type="submit" name="locale" value="en" aria-pressed={locale === "en"}>{t("lang.en")}</button>
        <button type="submit" name="locale" value="fr" aria-pressed={locale === "fr"}>{t("lang.fr")}</button>
      </form>
      {user ? (
        <form action={signOut}>
          <button className="secondary" type="submit">{t("nav.signOut")}</button>
        </form>
      ) : null}
    </header>
  );
}
