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
  /** False on a signed-out directory map, where played is not this golfer's record. */
  personal?: boolean;
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
  loading: string;
  failed: string;
  region: string;
  empty: string;
  signIn?: string;
};
