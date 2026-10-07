export const STANDING_GOLFERS = 30;
export const STANDING_ROUNDS = 8;
export const STANDING_MONTHS = 24;
export const SUITED_GOLFERS = 25;
export const SUITED_MONTHS = 36;

export type BandId = "0-9" | "10-18" | "19-28" | "29+";

export type ComparisonRound = {
  userId: string;
  playedOn: string;
  holes: number;
  differential: number | null;
};

export type CourseComparison = {
  standing: { percent: number; band: BandId; count: number } | null;
  suited: { band: BandId; count: number } | null;
};

export function shiftIsoDate(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function handicapBand(index: number): BandId | null {
  if (!Number.isFinite(index) || index < -10 || index > 54) return null;
  if (index < 10) return "0-9";
  if (index < 19) return "10-18";
  if (index < 29) return "19-28";
  return "29+";
}

export function bandLabel(band: BandId): string {
  return band.replace("-", "–");
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Standing is a percentile of score differential inside the viewer's handicap
 * band over 24 months. It stays hidden until 30 other golfers each have 8
 * rounds in that window. Suited is a separate fit: 25 golfers in the band
 * with a round in 36 months. One connected account cannot open either number.
 */
export function courseComparison(input: {
  viewerId: string;
  viewerIndex: number | null;
  rounds: ComparisonRound[];
  indexes: ReadonlyMap<string, number>;
  today: string;
}): CourseComparison {
  const band = input.viewerIndex == null ? null : handicapBand(input.viewerIndex);
  if (!band) return { standing: null, suited: null };

  const standingStart = shiftIsoDate(input.today, -STANDING_MONTHS);
  const suitedStart = shiftIsoDate(input.today, -SUITED_MONTHS);
  const byUser = new Map<string, ComparisonRound[]>();
  for (const round of input.rounds) {
    if (round.holes !== 9 && round.holes !== 18) continue;
    if (round.playedOn < suitedStart || round.playedOn > input.today) continue;
    const list = byUser.get(round.userId);
    if (list) list.push(round);
    else byUser.set(round.userId, [round]);
  }

  const inBand = (userId: string) => {
    const index = input.indexes.get(userId);
    return index != null && handicapBand(index) === band;
  };

  let suitedGolfers = 0;
  const standingMeans: number[] = [];
  for (const [userId, rounds] of byUser) {
    if (userId === input.viewerId || !inBand(userId)) continue;
    if (rounds.some((round) => round.playedOn >= suitedStart)) suitedGolfers += 1;
    const differentials = rounds
      .filter((round) => round.playedOn >= standingStart && round.differential != null)
      .map((round) => round.differential as number);
    if (differentials.length >= STANDING_ROUNDS) standingMeans.push(mean(differentials));
  }

  const viewerDifferentials = (byUser.get(input.viewerId) ?? [])
    .filter((round) => round.playedOn >= standingStart && round.differential != null)
    .map((round) => round.differential as number);

  const standing =
    standingMeans.length >= STANDING_GOLFERS && viewerDifferentials.length > 0
      ? {
          percent: Math.round(
            (standingMeans.filter((value) => value > mean(viewerDifferentials)).length / standingMeans.length) * 100,
          ),
          band,
          count: standingMeans.length,
        }
      : null;

  const suited =
    suitedGolfers >= SUITED_GOLFERS ? { band, count: suitedGolfers } : null;

  return { standing, suited };
}
