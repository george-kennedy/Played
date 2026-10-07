import { percentageLabel } from "./coverage";
import { translate, type Locale } from "./i18n";
import type { PublicShare } from "./types";
import { shareCardSvg, shareStorySvg, type ShareCardCopy } from "./share-card";

export function shareCardCopy(locale: Locale, payload: PublicShare): ShareCardCopy {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  return {
    brand: t("brand"),
    provinceLabel: t(`province.${payload.headlineProvince}`),
    provincePercent: percentageLabel(payload.provincialPercentage),
    provinceCount: t("coverage.count", {
      played: payload.provincialPlayed,
      total: payload.provincialTotal,
    }),
    canadaLabel: t("share.canadaLine"),
    canadaPercent: percentageLabel(payload.canadaPercentage),
    canadaCount: t("coverage.count", { played: payload.canadaPlayed, total: payload.canadaTotal }),
    firstLine: t("share.first", { count: payload.firstPlayedThisYear }),
    tagline: t("share.tagline"),
  };
}

export function buildShareCard(locale: Locale, payload: PublicShare): string {
  return shareCardSvg(shareCardCopy(locale, payload));
}

export function buildShareStory(locale: Locale, payload: PublicShare): string {
  return shareStorySvg(shareCardCopy(locale, payload));
}
