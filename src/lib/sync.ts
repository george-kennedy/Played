import { isIsoDate } from "./dates";
import { matchFacility } from "./import-csv";
import type { ScoreProvider } from "./providers";
import type { Facility, HoleCount, Round } from "./types";

export type IncomingRound = {
  externalRoundId: string;
  associationCourseId: string;
  courseName: string;
  playedOn: string;
  holes: HoleCount;
  score: number | null;
  differential: number | null;
};

export type ExistingRoundKey = {
  facilityId: string | null;
  playedOn: string;
  holes: number;
  provider: string | null;
  externalRoundId: string | null;
};

export type SyncPlan = {
  insert: Round[];
  duplicates: number;
  unmatched: number;
};

function roundKey(facilityId: string, playedOn: string, holes: number): string {
  return `${facilityId}|${playedOn}|${holes}`;
}

/**
 * The same round from two accounts counts once: same facility, date, and hole count.
 * A second delivery of the same provider id also counts once.
 * A round counts only when the course is already in the Canadian facility file.
 */
export function planIncoming(input: {
  facilities: Facility[];
  existing: ExistingRoundKey[];
  incoming: IncomingRound[];
  userId: string;
  provider: ScoreProvider;
  newId: () => string;
}): SyncPlan {
  const seenExternal = new Set(
    input.existing
      .filter((round) => round.provider === input.provider && round.externalRoundId)
      .map((round) => round.externalRoundId as string),
  );
  const seenFacility = new Set(
    input.existing
      .filter((round) => round.facilityId)
      .map((round) => roundKey(round.facilityId as string, round.playedOn, round.holes)),
  );
  const insert: Round[] = [];
  let duplicates = 0;
  let unmatched = 0;

  for (const round of input.incoming) {
    if (seenExternal.has(round.externalRoundId)) {
      duplicates += 1;
      continue;
    }
    const facility = matchFacility(input.facilities, round.courseName, round.associationCourseId);
    if (!facility) {
      unmatched += 1;
      continue;
    }
    const key = roundKey(facility.facilityId, round.playedOn, round.holes);
    if (seenFacility.has(key)) {
      duplicates += 1;
      seenExternal.add(round.externalRoundId);
      continue;
    }
    seenExternal.add(round.externalRoundId);
    seenFacility.add(key);
    insert.push({
      id: input.newId(),
      userId: input.userId,
      facilityId: facility.facilityId,
      playedOn: round.playedOn,
      holes: round.holes,
      score: round.score,
      scoreDifferential: round.differential,
      source: "sync",
      rawCourseName: round.courseName || null,
      rawAssociationCourseId: round.associationCourseId || null,
      provider: input.provider,
      externalRoundId: round.externalRoundId,
    });
  }

  return { insert, duplicates, unmatched };
}

export type BirdiesDownload = {
  memberId: string;
  handicapIndex: number | null;
  rounds: IncomingRound[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function holesOf(value: unknown): HoleCount | null {
  const holes = typeof value === "number" ? value : Number(text(value));
  if (holes === 9 || holes === 18) return holes;
  return null;
}

function wholeScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const score = typeof value === "number" ? value : Number(text(value));
  if (!Number.isInteger(score) || score < 20 || score > 200) return null;
  return score;
}

function differentialOf(value: unknown): number | null {
  if (value == null || value === "") return null;
  const differential = typeof value === "number" ? value : Number(text(value));
  if (!Number.isFinite(differential) || differential < -20 || differential > 60) return null;
  return differential;
}

function handicapOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -10 || value > 54) return null;
  return value;
}

/**
 * 18Birdies has no public API. This reads a personal account download when each
 * round includes a course, a date, and 9 or 18 holes.
 */
export function parseBirdiesDownload(value: unknown): BirdiesDownload | null {
  const body = asRecord(value);
  if (!body || !Array.isArray(body.rounds)) return null;
  if (body.rounds.length > 5000) return null;
  const rounds: IncomingRound[] = [];
  for (const item of body.rounds) {
    const row = asRecord(item);
    if (!row) continue;
    const courseName = text(row.courseName) || text(row.course);
    const associationCourseId = text(row.associationCourseId);
    const playedOn = text(row.playedOn) || text(row.date);
    const holes = holesOf(row.holes);
    if ((!courseName && !associationCourseId) || !isIsoDate(playedOn) || !holes) continue;
    const externalRoundId = text(row.id) || `${courseName}|${associationCourseId}|${playedOn}|${holes}`;
    rounds.push({
      externalRoundId,
      associationCourseId,
      courseName,
      playedOn,
      holes,
      score: wholeScore(row.score),
      differential: differentialOf(row.differential ?? row.scoreDifferential),
    });
  }
  if (rounds.length === 0) return null;
  const memberId = text(body.memberId) || "download";
  return { memberId, handicapIndex: handicapOf(body.handicapIndex), rounds };
}
