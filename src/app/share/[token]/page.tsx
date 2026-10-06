import { provinceLabel } from "@/components/coverage-block";
import { shareByToken } from "@/lib/auth";
import { percentageLabel } from "@/lib/coverage";
import { getDb, sharePayload } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { currentLocale } from "@/lib/session";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await currentLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const share = shareByToken(getDb(), token);
  if (!share?.enabled) {
    return (
      <div className="stack">
        <h1>{t("brand")}</h1>
        <p>{t("share.unavailable")}</p>
      </div>
    );
  }
  const payload = sharePayload(getDb(), share.userId);
  if (!payload) {
    return (
      <div className="stack">
        <h1>{t("brand")}</h1>
        <p>{t("share.unavailable")}</p>
      </div>
    );
  }
  return (
    <article className="stack">
      <h1>{t("brand")}</h1>
      <section className="card">
        <p className="muted">{provinceLabel(locale, payload.headlineProvince)}</p>
        <p className="coverage-text">
          <strong>{percentageLabel(payload.provincialPercentage)}</strong>
          {" · "}
          {t("coverage.count", { played: payload.provincialPlayed, total: payload.provincialTotal })}
        </p>
      </section>
      <section className="card">
        <p className="muted">{t("province.canada")}</p>
        <p className="coverage-text">
          <strong>{percentageLabel(payload.canadaPercentage)}</strong>
          {" · "}
          {t("coverage.count", { played: payload.canadaPlayed, total: payload.canadaTotal })}
        </p>
      </section>
      <p>{t("share.first", { count: payload.firstPlayedThisYear })}</p>
    </article>
  );
}
