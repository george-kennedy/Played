import rankings from "../../data/rankings.json";
import type { Access } from "./types";

const national = new Set(rankings.national);
const publicList = new Set(rankings.public);

export type RankingFilter = "" | "national" | "public";

export function rankingLists(facilityId: string): Array<"national" | "public"> {
  const lists: Array<"national" | "public"> = [];
  if (national.has(facilityId)) lists.push("national");
  if (publicList.has(facilityId)) lists.push("public");
  return lists;
}

export function matchesRanking(facilityId: string, filter: string): boolean {
  if (!filter) return true;
  if (filter === "national") return national.has(facilityId);
  if (filter === "public") return publicList.has(facilityId);
  return true;
}

export function matchesHoles(holeCount: number, filter: string): boolean {
  if (!filter) return true;
  if (filter === "9") return holeCount > 0 && holeCount < 18;
  if (filter === "18") return holeCount >= 18;
  return true;
}

export function matchesAccess(access: Access, filter: string): boolean {
  if (filter !== "public" && filter !== "private") return true;
  return access === filter;
}
