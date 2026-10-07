import { shareByToken } from "@/lib/auth";
import { percentageLabel } from "@/lib/coverage";
import { getDb, sharePayload } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { currentLocale } from "@/lib/session";
import { NextResponse } from "next/server";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const share = shareByToken(getDb(), token);
  if (!share?.enabled) return new NextResponse("Not found", { status: 404 });
  const payload = sharePayload(getDb(), share.userId);
  if (!payload) return new NextResponse("Not found", { status: 404 });
  const locale = await currentLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const province = t(`province.${payload.headlineProvince}`);
  const lines = [
    "Played",
    `${province}: ${percentageLabel(payload.provincialPercentage)} · ${t("coverage.count", { played: payload.provincialPlayed, total: payload.provincialTotal })}`,
    `${t("province.canada")}: ${percentageLabel(payload.canadaPercentage)} · ${t("coverage.count", { played: payload.canadaPlayed, total: payload.canadaTotal })}`,
    t("share.first", { count: payload.firstPlayedThisYear }),
  ];
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
  <rect width="900" height="520" fill="#f3efe4"/>
  <text x="48" y="90" font-family="Palatino, Georgia, serif" font-size="54" fill="#1b2418">${escapeXml(lines[0])}</text>
  <text x="48" y="180" font-family="Avenir Next, sans-serif" font-size="28" fill="#1b2418">${escapeXml(lines[1])}</text>
  <text x="48" y="240" font-family="Avenir Next, sans-serif" font-size="28" fill="#1b2418">${escapeXml(lines[2])}</text>
  <text x="48" y="320" font-family="Avenir Next, sans-serif" font-size="28" fill="#1b2418">${escapeXml(lines[3])}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
