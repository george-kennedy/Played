import type {
  Coverage,
  CoverageFilters,
  Denominator,
  Facility,
  Province,
  PublicShare,
  Round,
} from "./types";
import { PROVINCES } from "./types";
import { yearOfPlayedOn } from "./dates";

export type CoverageRound = Pick<Round, "facilityId" | "playedOn" | "holes">;

function inDenominator(facility: Facility, denominator: Denominator): boolean {
  if (denominator.kind === "canada") return true;
  return facility.province === denominator.province;
}

function passesFilters(facility: Facility, filters: CoverageFilters | undefined): boolean {
  if (filters?.eighteenHoleOnly && facility.holeCount < 18) return false;
  if (filters?.publicOnly && facility.access !== "public") return false;
  return true;
}

/**
 * Coverage is played facilities divided by the facilities in the denominator.
 * A facility is played when it has at least one 9- or 18-hole round.
 * This year and earlier partition that played set by the calendar year of
 * the earliest round. They do not overlap.
 */
export function coverage(input: {
  facilities: Facility[];
  rounds: CoverageRound[];
  denominator: Denominator;
  filters?: CoverageFilters;
  year: number;
}): Coverage {
  const denominatorFacilities = input.facilities.filter(
    (facility) => inDenominator(facility, input.denominator) && passesFilters(facility, input.filters),
  );
  const allowed = new Set(denominatorFacilities.map((facility) => facility.facilityId));
  const earliest = new Map<string, string>();

  for (const round of input.rounds) {
    if (!round.facilityId || !allowed.has(round.facilityId)) continue;
    if (round.holes !== 9 && round.holes !== 18) continue;
    const current = earliest.get(round.facilityId);
    if (!current || round.playedOn < current) earliest.set(round.facilityId, round.playedOn);
  }

  let thisYear = 0;
  let earlier = 0;
  for (const playedOn of earliest.values()) {
    const roundYear = yearOfPlayedOn(playedOn);
    if (roundYear === input.year) thisYear += 1;
    else if (roundYear < input.year) earlier += 1;
  }

  const played = thisYear + earlier;
  const total = denominatorFacilities.length;
  return {
    played,
    total,
    thisYear,
    earlier,
    percentage: total === 0 ? null : played / total,
  };
}

export function percentageLabel(percentage: number | null): string {
  if (percentage === null) return "—";
  return `${Math.round(percentage * 100)}%`;
}

export function scopeKey(denominator: Denominator): Province | "CANADA" {
  return denominator.kind === "canada" ? "CANADA" : denominator.province;
}

export function allScopes(): Array<Province | "CANADA"> {
  return [...PROVINCES, "CANADA"];
}

export function denominatorForScope(scope: Province | "CANADA"): Denominator {
  if (scope === "CANADA") return { kind: "canada" };
  return { kind: "province", province: scope };
}

export function publicShare(input: {
  headlineProvince: Province;
  provincial: Coverage;
  canada: Coverage;
}): PublicShare {
  return {
    headlineProvince: input.headlineProvince,
    provincialPlayed: input.provincial.played,
    provincialTotal: input.provincial.total,
    provincialPercentage: input.provincial.percentage,
    canadaPlayed: input.canada.played,
    canadaTotal: input.canada.total,
    canadaPercentage: input.canada.percentage,
    firstPlayedThisYear: input.canada.thisYear,
  };
}
