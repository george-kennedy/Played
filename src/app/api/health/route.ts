import { getDb, listFacilities } from "@/lib/db";
import { NextResponse } from "next/server";

/** Liveness for container health checks. Confirms the process and SQLite seed. */
export async function GET() {
  try {
    const count = listFacilities(getDb()).length;
    if (count < 1) {
      return NextResponse.json({ ok: false, reason: "empty" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, facilities: count });
  } catch {
    return NextResponse.json({ ok: false, reason: "db" }, { status: 503 });
  }
}
