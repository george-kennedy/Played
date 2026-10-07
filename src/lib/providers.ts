export type ScoreProvider = "golf_canada" | "ghin" | "birdies";

export class ScoreFeedClosed extends Error {
  constructor(readonly reason: "agreement" | "endpoint") {
    super(reason);
    this.name = "ScoreFeedClosed";
  }
}

/** Live Golf Canada scores require a licensed partner client. A password is never a credential. */
export function golfCanadaLicensed(): boolean {
  return Boolean(process.env.GOLFCANADA_CLIENT_ID?.trim() && process.env.GOLFCANADA_CLIENT_SECRET?.trim());
}

/** GHIN reads require the USGA Golfer Product Access program. */
export function ghinLicensed(): boolean {
  return Boolean(process.env.GHIN_CLIENT_ID?.trim() && process.env.GHIN_CLIENT_SECRET?.trim());
}

export async function pullGolfCanada(_memberId: string): Promise<{
  handicapIndex: number | null;
  rounds: import("./sync").IncomingRound[];
}> {
  if (!golfCanadaLicensed()) throw new ScoreFeedClosed("agreement");
  throw new ScoreFeedClosed("endpoint");
}

export async function pullGhin(_memberId: string): Promise<{
  handicapIndex: number | null;
  rounds: import("./sync").IncomingRound[];
}> {
  if (!ghinLicensed()) throw new ScoreFeedClosed("agreement");
  throw new ScoreFeedClosed("endpoint");
}
