import { chooseProvince, removeAccount } from "@/app/actions";
import { PROVINCES } from "@/lib/types";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const locale = await currentLocale();
  const query = await searchParams;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="stack">
      <h1>{t("account.title")}</h1>
      <p><strong>{t("account.email")}</strong> {user.email}</p>
      {!user.email_verified_at ? (
        <p><a href="/verify-email">{t("account.verifyNeeded")}</a></p>
      ) : null}
      <form className="stack card" action={chooseProvince}>
        <h2>{t("account.province")}</h2>
        <p className="help">{t("home.provinceHelp")}</p>
        {PROVINCES.map((province) => (
          <label key={province} className="inline">
            <input type="radio" name="province" value={province} required defaultChecked={user.headline_province === province} />
            {t(`province.${province}`)}
          </label>
        ))}
        <button type="submit">{t("home.saveProvince")}</button>
      </form>
      <p><a className="button secondary" href="/account/export">{t("account.export")}</a></p>
      <p><a href="/reset-password">{t("account.reset")}</a></p>
      <form className="stack card" action={removeAccount}>
        <h2>{t("account.delete")}</h2>
        <p className="help">{t("account.deleteHelp")}</p>
        {query.error === "confirm" ? <p className="error">{t("account.deleteConfirm")}</p> : null}
        <label>
          {t("account.deleteConfirm")}
          <input name="confirm" autoComplete="off" />
        </label>
        <button className="danger" type="submit">{t("account.deleteButton")}</button>
      </form>
    </div>
  );
}
