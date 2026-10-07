import { loadCourseMedia } from "@/lib/course-media";
import { getDb, getFacility } from "@/lib/db";

const empty = { photoUrl: null, websiteUrl: null };

export async function GET(_request: Request, context: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await context.params;
  const facility = getFacility(getDb(), facilityId);
  if (!facility) return Response.json(empty, { status: 404 });
  const media = await loadCourseMedia(facility);
  return Response.json({
    photoUrl: media.photoUrl,
    websiteUrl: media.websiteUrl,
  });
}
