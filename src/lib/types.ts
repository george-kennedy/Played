export const PROVINCES = ["BC", "AB", "SK", "MB", "ON", "QC", "NB", "PEI", "NS", "NL", "YT", "NT"] as const;
export type Province = (typeof PROVINCES)[number];
export type Access = "public" | "private";
export type RoundSource = "mark" | "manual" | "import" | "sync";
export type HoleCount = 9 | 18;

export type Facility = {
  facilityId: string;
  officialName: string;
  province: Province;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  holeCount: number;
  access: Access;
  associationCourseId: string | null;
  associationCourseIds: string[];
  rating: number | null;
  slope: number | null;
  sourceUrl: string;
  mergedRoutings: boolean;
};

export type Round = {
  id: string;
  userId: string;
  facilityId: string | null;
  playedOn: string;
  holes: HoleCount;
  score: number | null;
  scoreDifferential: number | null;
  source: RoundSource;
  rawCourseName: string | null;
  rawAssociationCourseId: string | null;
  provider?: string | null;
  externalRoundId?: string | null;
};

export type Denominator =
  | { kind: "province"; province: Province }
  | { kind: "canada" };

export type CoverageFilters = {
  eighteenHoleOnly?: boolean;
  publicOnly?: boolean;
};

export type Coverage = {
  played: number;
  total: number;
  thisYear: number;
  earlier: number;
  percentage: number | null;
};

export type PublicShare = {
  headlineProvince: Province;
  provincialPlayed: number;
  provincialTotal: number;
  provincialPercentage: number | null;
  canadaPlayed: number;
  canadaTotal: number;
  canadaPercentage: number | null;
  firstPlayedThisYear: number;
};
