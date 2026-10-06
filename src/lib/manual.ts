import { isIsoDate } from "./dates";
import type { HoleCount, Round } from "./types";

export type ManualRoundResult =
  | { ok: true; round: Round }
  | { ok: false; reason: "bad_date" | "future_date" | "bad_holes" | "bad_score" | "conflict" };

export function addManualRound(input: {
  existing: Round[];
  userId: string;
  facilityId: string;
  playedOn: string;
  holes: string;
  scoreRaw: string;
  today: string;
  newId: string;
}): ManualRoundResult {
  if (!isIsoDate(input.playedOn) || input.playedOn > input.today) {
    return { ok: false, reason: input.playedOn > input.today && isIsoDate(input.playedOn) ? "future_date" : "bad_date" };
  }
  if (input.holes !== "9" && input.holes !== "18") return { ok: false, reason: "bad_holes" };
  const holes = Number(input.holes) as HoleCount;
  let score: number | null = null;
  if (input.scoreRaw.trim() !== "") {
    if (!/^\d+$/.test(input.scoreRaw.trim())) return { ok: false, reason: "bad_score" };
    score = Number(input.scoreRaw.trim());
  }
  const conflict = input.existing.some(
    (round) =>
      round.facilityId === input.facilityId && round.playedOn === input.playedOn && round.holes === holes,
  );
  if (conflict) return { ok: false, reason: "conflict" };
  return {
    ok: true,
    round: {
      id: input.newId,
      userId: input.userId,
      facilityId: input.facilityId,
      playedOn: input.playedOn,
      holes,
      score,
      scoreDifferential: null,
      source: "manual",
      rawCourseName: null,
      rawAssociationCourseId: null,
    },
  };
}
