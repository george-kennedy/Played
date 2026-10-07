import { toggleShare } from "@/app/actions";
import { CoverageBlock, provinceLabel } from "@/components/coverage-block";
import { shareForUser } from "@/lib/auth";
import { getDb, readSummary, sharePayload } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function SeasonPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.headline_province) redirect("/");
  const locale = await currentLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const db = getDb();
  const payload = sharePayload(db, user.id);
  const provincial = readSummary(db, user.id, user.headline_province);
  const canada = readSummary(db, user.id, "CANADA");
  const share = shareForUser(db, user.id);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const url = share ? `${origin}/share/${share.token}` : "";

  return (
    <div className="stack">
      <h1>{t("season.title")}</h1>
      <p className="help">{t("season.private")}</p>
      {provincial ? <CoverageBlock locale={locale} summary={provincial} label={provinceLabel(locale, user.headline_province)} /> : null}
      {canada ? <CoverageBlock locale={locale} summary={canada} label={t("province.canada")} /> : null}
      <p>{t("season.first", { count: payload?.firstPlayedThisYear ?? canada?.this_year_count ?? 0 })}</p>
      <section className="card stack">
        <p>{t("season.shareHelp")}</p>
        {share?.enabled ? (
          <>
            <p>
              <span className="muted">{t("season.link")}</span><br />
              <a href={url}>{url}</a>
            </p>
            <p><a href={`/share/${share.token}/card`} download="played-card.svg">{t("season.image")}</a></p>
            <p><a href={`/share/${share.token}/story`} download="played-story.svg">{t("season.story")}</a></p>
            <form action={toggleShare}>
              <input type="hidden" name="enabled" value="0" />
              <button className="secondary" type="submit">{t("season.shareOff")}</button>
            </form>
          </>
        ) : (
          <form action={toggleShare}>
            <input type="hidden" name="enabled" value="1" />
            <button type="submit">{t("season.shareOn")}</button>
          </form>
        )}
      </section>
    </div>
  );
}
