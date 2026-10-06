import { isIsoDate } from "./dates";
import { normalizeName } from "./names";
import type { Facility, HoleCount, Round } from "./types";

export type ImportReason =
  | "missing_header"
  | "bad_date"
  | "bad_holes"
  | "missing_course"
  | "bad_score"
  | "bad_differential"
  | "conflict";

export type ImportFailure = {
  line: number;
  reason: ImportReason;
  courseName: string;
};

export type ImportUnmatched = {
  line: number;
  courseName: string;
  playedOn: string;
  holes: HoleCount;
};

export type ImportResult = {
  toInsert: Round[];
  failures: ImportFailure[];
  unmatched: ImportUnmatched[];
  duplicates: number;
  acceptedMatched: number;
};

type WorkingRound = Round;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((record) => record.some((value) => value.trim() !== ""));
}

function scoresEqual(
  leftScore: number | null,
  leftDiff: number | null,
  rightScore: number | null,
  rightDiff: number | null,
): boolean {
  return leftScore === rightScore && leftDiff === rightDiff;
}

function keyOf(facilityId: string, playedOn: string, holes: number): string {
  return `${facilityId}|${playedOn}|${holes}`;
}

function unmatchedKey(name: string, playedOn: string, holes: number): string {
  return `${normalizeName(name)}|${playedOn}|${holes}`;
}

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

/** Confirming a match can only select a facility already in the seed. */
export function confirmFacility(facilities: Facility[], facilityId: string): Facility | null {
  return facilities.find((facility) => facility.facilityId === facilityId) ?? null;
}

/**
 * Valid rows are kept when other rows fail. Same key and same scores is a
 * duplicate and is not inserted again. Same key and different scores is a
 * conflict and does not overwrite. Unknown courses stay unmatched.
 */
export function importCsv(input: {
  csv: string;
  facilities: Facility[];
  existing: Round[];
  userId: string;
  newId: () => string;
}): ImportResult {
  const table = parseCsv(input.csv);
  const failures: ImportFailure[] = [];
  const unmatched: ImportUnmatched[] = [];
  const toInsert: Round[] = [];
  let duplicates = 0;
  let acceptedMatched = 0;

  if (table.length === 0) {
    return { toInsert, failures: [{ line: 1, reason: "missing_header", courseName: "" }], unmatched, duplicates, acceptedMatched };
  }

  const header = table[0].map((cell) => cell.trim());
  const index = new Map(header.map((name, position) => [name, position]));
  for (const required of ["played_on", "course_name", "holes"]) {
    if (!index.has(required)) {
      return {
        toInsert,
        failures: [{ line: 1, reason: "missing_header", courseName: "" }],
        unmatched,
        duplicates,
        acceptedMatched,
      };
    }
  }

  const working = input.existing.slice();

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const line = rowIndex + 1;
    const cells = table[rowIndex];
    const read = (name: string) => {
      const position = index.get(name);
      if (position === undefined) return "";
      return (cells[position] ?? "").trim();
    };
    const courseName = read("course_name");
    const playedOn = read("played_on");
    const holesRaw = read("holes");
    const associationId = read("association_course_id");
    const scoreRaw = read("score");
    const diffRaw = read("score_differential");

    if (!isIsoDate(playedOn)) {
      failures.push({ line, reason: "bad_date", courseName });
      continue;
    }
    if (holesRaw !== "9" && holesRaw !== "18") {
      failures.push({ line, reason: "bad_holes", courseName });
      continue;
    }
    const holes = Number(holesRaw) as HoleCount;
    if (!courseName && !associationId) {
      failures.push({ line, reason: "missing_course", courseName });
      continue;
    }

    let score: number | null = null;
    if (scoreRaw !== "") {
      if (!/^\d+$/.test(scoreRaw)) {
        failures.push({ line, reason: "bad_score", courseName });
        continue;
      }
      score = Number(scoreRaw);
    }
    let scoreDifferential: number | null = null;
    if (diffRaw !== "") {
      const parsed = Number(diffRaw);
      if (!Number.isFinite(parsed)) {
        failures.push({ line, reason: "bad_differential", courseName });
        continue;
      }
      scoreDifferential = parsed;
    }

    const facility = matchFacility(input.facilities, courseName, associationId);
    if (!facility) {
      const existingUnmatched = working.find(
        (round) =>
          round.facilityId === null &&
          unmatchedKey(round.rawCourseName ?? "", round.playedOn, round.holes) ===
            unmatchedKey(courseName, playedOn, holes),
      );
      if (existingUnmatched) {
        if (scoresEqual(existingUnmatched.score, existingUnmatched.scoreDifferential, score, scoreDifferential)) {
          duplicates += 1;
        } else {
          failures.push({ line, reason: "conflict", courseName });
        }
        continue;
      }
      const created: Round = {
        id: input.newId(),
        userId: input.userId,
        facilityId: null,
        playedOn,
        holes,
        score,
        scoreDifferential,
        source: "import",
        rawCourseName: courseName,
        rawAssociationCourseId: associationId || null,
      };
      working.push(created);
      toInsert.push(created);
      unmatched.push({ line, courseName, playedOn, holes });
      continue;
    }

    const existing = working.find(
      (round) =>
        round.facilityId !== null &&
        keyOf(round.facilityId, round.playedOn, round.holes) === keyOf(facility.facilityId, playedOn, holes),
    );
    if (existing) {
      if (scoresEqual(existing.score, existing.scoreDifferential, score, scoreDifferential)) {
        duplicates += 1;
      } else {
        failures.push({ line, reason: "conflict", courseName });
      }
      continue;
    }

    const created: Round = {
      id: input.newId(),
      userId: input.userId,
      facilityId: facility.facilityId,
      playedOn,
      holes,
      score,
      scoreDifferential,
      source: "import",
      rawCourseName: courseName,
      rawAssociationCourseId: associationId || null,
    };
    working.push(created);
    toInsert.push(created);
    acceptedMatched += 1;
  }

  return { toInsert, failures, unmatched, duplicates, acceptedMatched };
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
