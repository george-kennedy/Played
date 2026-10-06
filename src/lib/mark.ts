import type { HoleCount, Round } from "./types";

export function markHoleCount(facilityHoleCount: number): HoleCount {
  return facilityHoleCount >= 18 ? 18 : 9;
}

export type MarkToggleResult = {
  created: Round | null;
  removedIds: string[];
};

/**
 * Turning a not-played course on records one round dated today.
 * Turning it off deletes only rounds this toggle created (source mark).
 * Imported and manual rounds stay.
 */
export function toggleMark(input: {
  rounds: Round[];
  facilityId: string;
  facilityHoleCount: number;
  today: string;
  turnOn: boolean;
  userId: string;
  newId: string;
}): MarkToggleResult {
  const holes = markHoleCount(input.facilityHoleCount);
  if (!input.turnOn) {
    const removedIds = input.rounds
      .filter((round) => round.facilityId === input.facilityId && round.source === "mark")
      .map((round) => round.id);
    return { created: null, removedIds };
  }

  const alreadyMarked = input.rounds.some(
    (round) => round.facilityId === input.facilityId && round.source === "mark",
  );
  if (alreadyMarked) return { created: null, removedIds: [] };

  const sameKey = input.rounds.some(
    (round) =>
      round.facilityId === input.facilityId &&
      round.playedOn === input.today &&
      round.holes === holes,
  );
  if (sameKey) return { created: null, removedIds: [] };

  return {
    created: {
      id: input.newId,
      userId: input.userId,
      facilityId: input.facilityId,
      playedOn: input.today,
      holes,
      score: null,
      scoreDifferential: null,
      source: "mark",
      rawCourseName: null,
      rawAssociationCourseId: null,
    },
    removedIds: [],
  };
}

export function isPlayed(rounds: Pick<Round, "facilityId" | "holes">[], facilityId: string): boolean {
  return rounds.some(
    (round) => round.facilityId === facilityId && (round.holes === 9 || round.holes === 18),
  );
}
