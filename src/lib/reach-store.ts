import fs from "node:fs";
import path from "node:path";
import { bookingFeatureOn, shownReach } from "./course-media";

type ReachRow = {
  facilityId: string;
  bookingUrl: string | null;
  phone: string | null;
  enabled: boolean;
};

function rows(): Map<string, ReachRow> {
  const file = path.join(process.cwd(), "data", "reach.json");
  if (!fs.existsSync(file)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { courses?: ReachRow[] };
  const map = new Map((parsed.courses ?? []).map((row) => [row.facilityId, row]));
  // Curated corrections, folded into reach.json on its next rebuild.
  for (const facilityId of ["mb-shanks-driving-range-and-grill"]) map.delete(facilityId);
  for (const row of REACH_ADDITIONS) map.set(row.facilityId, row);
  return map;
}

/** Cabot Cape Breton (cabot.com/capebreton, reservations 1-855-652-2268). */
const REACH_ADDITIONS: ReachRow[] = [
  { facilityId: "ns-cabot-cliffs", bookingUrl: "https://cabot.com/capebreton/", phone: "1-855-652-2268", enabled: true },
  { facilityId: "ns-cabot-links", bookingUrl: "https://cabot.com/capebreton/", phone: "1-855-652-2268", enabled: true },
  { facilityId: "ns-cabot-the-nest", bookingUrl: "https://cabot.com/capebreton/", phone: "1-855-652-2268", enabled: true },
];

/** Book or Call for a course. Off unless the feature and that course's switch are both on. */
export function reachAction(access: string, facilityId: string): { bookingUrl: string | null; phone: string | null } {
  return shownReach(access, rows().get(facilityId) ?? null, bookingFeatureOn());
}
