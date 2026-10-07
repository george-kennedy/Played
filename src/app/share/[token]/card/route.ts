import { shareByToken } from "@/lib/auth";
import { getDb, sharePayload } from "@/lib/db";
import { buildShareCard } from "@/lib/share-card-build";
import { svgToPng } from "@/lib/share-card-png";
import { currentLocale } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const share = shareByToken(getDb(), token);
  if (!share?.enabled) return new NextResponse("Not found", { status: 404 });
  const payload = sharePayload(getDb(), share.userId);
  if (!payload) return new NextResponse("Not found", { status: 404 });
  const locale = await currentLocale();
  // PNG, not SVG: Facebook's og:image scraper and Instagram cannot display SVG.
  const png = new Blob([svgToPng(buildShareCard(locale, payload)) as BlobPart], { type: "image/png" });
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
