import type { Metadata } from "next";
import { headers } from "next/headers";
import { provinceLabel } from "@/components/coverage-block";
import { shareByToken } from "@/lib/auth";
import { percentageLabel } from "@/lib/coverage";
import { getDb, sharePayload } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { currentLocale } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const locale = await currentLocale();
  const share = shareByToken(getDb(), token);
  const payload = share?.enabled ? sharePayload(getDb(), share.userId) : null;
  const title = payload
    ? translate(locale, "share.ogTitle", { percent: percentageLabel(payload.canadaPercentage) })
    : translate(locale, "brand");
  const description = payload
    ? `${provinceLabel(locale, payload.headlineProvince)} · ${percentageLabel(payload.provincialPercentage)} · ${translate(locale, "share.tagline")}`
    : translate(locale, "share.tagline");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const image = host ? `${proto}://${host}/share/${token}/card` : `/share/${token}/card`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: payload ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: payload ? [image] : undefined,
    },
  };
}

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
    <article className="share-stage">
      <p className="share-stage-brand">{t("brand")}</p>
      <p className="share-stage-tag">{t("share.tagline")}</p>
      <p className="share-stage-percent">{percentageLabel(payload.canadaPercentage)}</p>
      <p className="share-stage-line">{t("share.canadaLine")}</p>
      <p className="share-stage-meta">
        {t("coverage.count", { played: payload.canadaPlayed, total: payload.canadaTotal })}
      </p>
      <hr className="share-stage-rule" />
      <p className="share-stage-province">
        {provinceLabel(locale, payload.headlineProvince)} · {percentageLabel(payload.provincialPercentage)}
      </p>
      <p className="share-stage-meta">
        {t("coverage.count", { played: payload.provincialPlayed, total: payload.provincialTotal })}
        {" · "}
        {t("share.first", { count: payload.firstPlayedThisYear })}
      </p>
      <p className="share-stage-cta">
        <a className="button" href="/sign-up">
          {t("share.join")}
        </a>
      </p>
    </article>
  );
}
