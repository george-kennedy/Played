import { loadCourseMedia } from "@/lib/course-media";
import { getDb, getFacility } from "@/lib/db";
import { reachAction } from "@/lib/reach-store";

const empty = { photoUrl: null, websiteUrl: null, bookingUrl: null, phone: null };

export async function GET(_request: Request, context: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await context.params;
  const facility = getFacility(getDb(), facilityId);
  if (!facility) return Response.json(empty, { status: 404 });
  const media = await loadCourseMedia(facility);
  const action = reachAction(facility.access, facility.facilityId);
  return Response.json({
    photoUrl: media.photoUrl,
    websiteUrl: media.websiteUrl,
    bookingUrl: action.bookingUrl,
    phone: action.phone,
  });
}
