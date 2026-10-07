export type PinRound = {
  id: string;
  playedOn: string;
  score: number | null;
  holesLabel: string;
};

export type PinCourse = {
  facilityId: string;
  name: string;
  placeLine: string;
  played: boolean;
  latitude: number;
  longitude: number;
  defaultHoles: "9" | "18";
  markRoundId: string | null;
  rounds: PinRound[];
  standing?: string | null;
  suited?: string | null;
  lists?: Array<"national" | "public">;
  ratingLine?: string | null;
  /** False on a signed-out directory map, where played is not this golfer's record. */
  personal?: boolean;
  /** When set, mark and add-round send the visitor here instead of saving a round. */
  signupHref?: string;
};

export type PinMapLabels = {
  played: string;
  notPlayed: string;
  markOn: string;
  markOff: string;
  playedKeep: string;
  rounds: string;
  noRounds: string;
  addRound: string;
  date: string;
  holes: string;
  score: string;
  scoreOptional: string;
  secondRound: string;
  courseLink: string;
  expand: string;
  collapse: string;
  close: string;
  website: string;
  rankings: string;
  onNational: string;
  onPublic: string;
  noRanking: string;
  reviews: string;
  noReviews: string;
  noPhoto: string;
  photoLoading: string;
  loading: string;
  failed: string;
  region: string;
  empty: string;
  signIn?: string;
};
