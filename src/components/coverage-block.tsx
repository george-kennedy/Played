import { percentageLabel } from "@/lib/coverage";
import { translate, type Locale } from "@/lib/i18n";
import type { SummaryRow } from "@/lib/db";
import type { Province } from "@/lib/types";

export function CoverageBlock({
  locale,
  summary,
  label,
}: {
  locale: Locale;
  summary: SummaryRow;
  label: string;
}) {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const played = summary.played_count;
  const total = summary.total_count;
  const thisYear = summary.this_year_count;
  const earlier = summary.earlier_count;
  const rest = Math.max(0, total - played);
  const yearPct = total === 0 ? 0 : (thisYear / total) * 100;
  const earlierPct = total === 0 ? 0 : (earlier / total) * 100;
  return (
    <section className="card" aria-label={label}>
      <p className="muted" style={{ margin: 0 }}>{label}</p>
      <p className="coverage-text">
        <strong>{percentageLabel(summary.percentage)}</strong>
        {" · "}
        {t("coverage.count", { played, total })}
      </p>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${yearPct}%` }} />
        <span style={{ width: `${earlierPct}%` }} />
      </div>
      <p className="legend">
        <span><i className="swatch year" aria-hidden="true" />{t("home.thisYear")} {thisYear}</span>
        <span><i className="swatch earlier" aria-hidden="true" />{t("home.earlier")} {earlier}</span>
        <span><i className="swatch rest" aria-hidden="true" />{t("home.notPlayed")} {rest}</span>
      </p>
    </section>
  );
}

export function provinceLabel(locale: Locale, province: Province | "CANADA"): string {
  if (province === "CANADA") return translate(locale, "province.canada");
  return translate(locale, `province.${province}`);
}
