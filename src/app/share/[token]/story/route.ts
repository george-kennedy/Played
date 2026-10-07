import { shareByToken } from "@/lib/auth";
import { getDb, sharePayload } from "@/lib/db";
import { buildShareStory } from "@/lib/share-card-build";
import { currentLocale } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const share = shareByToken(getDb(), token);
  if (!share?.enabled) return new NextResponse("Not found", { status: 404 });
  const payload = sharePayload(getDb(), share.userId);
  if (!payload) return new NextResponse("Not found", { status: 404 });
  const locale = await currentLocale();
  return new NextResponse(buildShareStory(locale, payload), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="played-story.svg"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
