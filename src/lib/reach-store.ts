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
  return new Map((parsed.courses ?? []).map((row) => [row.facilityId, row]));
}

/** Book or Call for a course. Off unless the feature and that course's switch are both on. */
export function reachAction(access: string, facilityId: string): { bookingUrl: string | null; phone: string | null } {
  return shownReach(access, rows().get(facilityId) ?? null, bookingFeatureOn());
}
