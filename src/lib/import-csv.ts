import { normalizeName } from "./names";
import type { Facility, Round } from "./types";

/**
 * Shared CSV helpers. The generic CSV import UI was removed (the /import page
 * redirects to /connect); what remains is the facility matcher used by the
 * provider sync and the CSV writer used by the account export.
 */
export function matchFacility(
  facilities: Facility[],
  courseName: string,
  associationCourseId: string,
): Facility | null {
  const id = associationCourseId.trim();
  if (id) {
    const byId = facilities.find(
      (facility) =>
        facility.associationCourseIds.includes(id) || facility.associationCourseId === id,
    );
    if (byId) return byId;
  }
  const name = normalizeName(courseName);
  if (!name) return null;
  return facilities.find((facility) => normalizeName(facility.officialName) === name) ?? null;
}

export function roundsToCsv(rounds: Array<Round & { courseName: string; associationCourseId: string }>): string {
  const header = "played_on,course_name,holes,association_course_id,score,score_differential";
  const lines = rounds.map((round) =>
    [
      round.playedOn,
      csvCell(round.courseName),
      String(round.holes),
      csvCell(round.associationCourseId),
      round.score === null ? "" : String(round.score),
      round.scoreDifferential === null ? "" : String(round.scoreDifferential),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
