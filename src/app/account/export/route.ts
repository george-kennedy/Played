import { roundsToCsv } from "@/lib/import-csv";
import { getDb, listFacilities } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (!user.email_verified_at) return NextResponse.redirect(new URL("/verify-email", request.url));
  const db = getDb();
  const facilities = new Map(listFacilities(db).map((facility) => [facility.facilityId, facility]));
  const rows = db
    .prepare("SELECT * FROM rounds WHERE user_id = ? ORDER BY played_on, holes")
    .all(user.id) as Array<{
    played_on: string;
    holes: number;
    score: number | null;
    score_differential: number | null;
    facility_id: string | null;
    raw_course_name: string | null;
    raw_association_course_id: string | null;
    id: string;
    user_id: string;
    source: "mark" | "manual" | "import" | "sync";
  }>;
  const csv = roundsToCsv(
    rows.map((row) => {
      const facility = row.facility_id ? facilities.get(row.facility_id) : undefined;
      return {
        id: row.id,
        userId: row.user_id,
        facilityId: row.facility_id,
        playedOn: row.played_on,
        holes: row.holes as 9 | 18,
        score: row.score,
        scoreDifferential: row.score_differential,
        source: row.source,
        rawCourseName: row.raw_course_name,
        rawAssociationCourseId: row.raw_association_course_id,
        courseName: facility?.officialName ?? row.raw_course_name ?? "",
        associationCourseId: facility?.associationCourseId ?? row.raw_association_course_id ?? "",
      };
    }),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"played-rounds.csv\"",
    },
  });
}
