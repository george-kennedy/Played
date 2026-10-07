import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createUser } from "./auth";
import {
  applyProviderSync,
  disconnectProvider,
  getFacility,
  listExternalLinks,
  listFacilityRounds,
  loadComparisons,
  openDatabase,
} from "./db";
import { pullGolfCanada, ScoreFeedClosed } from "./providers";
import { parseBirdiesDownload, type IncomingRound } from "./sync";

const opened: Array<{ close: () => void }> = [];

function database() {
  const dir = mkdtempSync(path.join(tmpdir(), "played-"));
  const db = openDatabase(path.join(dir, "test.sqlite"));
  opened.push(db);
  return db;
}

afterEach(() => {
  for (const db of opened) db.close();
  opened.length = 0;
});

function posted(id: string, courseName: string, associationCourseId: string, playedOn = "2026-06-01"): IncomingRound {
  return {
    externalRoundId: id,
    associationCourseId,
    courseName,
    playedOn,
    holes: 18,
    score: 82,
    differential: 8.4,
  };
}

describe("account sync", () => {
  it("stores a Golf Canada round once, skips a US course, and keeps the round after disconnect", () => {
    const db = database();
    createUser(db, {
      id: "u",
      email: "golfer@example.com",
      password: "longpassword",
      createdAt: "2026-10-06T12:00:00.000Z",
    });
    const pippy = getFacility(db, "nl-pippy-park-golf-course");
    expect(pippy).not.toBeNull();
    const round = posted("gc-1", pippy!.officialName, pippy!.associationCourseId ?? "");
    const first = applyProviderSync(db, {
      userId: "u",
      provider: "golf_canada",
      externalId: "M12345",
      handicapIndex: 14.2,
      rounds: [round],
      syncedAt: "2026-10-06T12:00:00.000Z",
      newId: () => "r1",
    });
    expect(first).toEqual({ added: 1, duplicates: 0, unmatched: 0 });
    const again = applyProviderSync(db, {
      userId: "u",
      provider: "golf_canada",
      externalId: "M12345",
      handicapIndex: null,
      rounds: [round],
      syncedAt: "2026-10-06T12:30:00.000Z",
      newId: () => "r2",
    });
    expect(again.duplicates).toBe(1);
    const birdies = applyProviderSync(db, {
      userId: "u",
      provider: "birdies",
      externalId: "download",
      handicapIndex: null,
      rounds: [{ ...round, externalRoundId: "b-1" }],
      syncedAt: "2026-10-06T13:00:00.000Z",
      newId: () => "r3",
    });
    expect(birdies).toMatchObject({ added: 0, duplicates: 1 });
    const foreign = applyProviderSync(db, {
      userId: "u",
      provider: "birdies",
      externalId: "download",
      handicapIndex: null,
      rounds: [posted("us-1", "Pebble Beach Golf Links", "not-canadian", "2026-07-01")],
      syncedAt: "2026-10-06T14:00:00.000Z",
      newId: () => "r4",
    });
    expect(foreign).toEqual({ added: 0, duplicates: 0, unmatched: 1 });
    expect(listFacilityRounds(db, "u", pippy!.facilityId)).toHaveLength(1);
    expect(disconnectProvider(db, "u", "golf_canada")).toBe(true);
    expect(listFacilityRounds(db, "u", pippy!.facilityId)).toHaveLength(1);
    const link = listExternalLinks(db, "u").find((item) => item.provider === "golf_canada");
    expect(link?.status).toBe("disconnected");
    expect(link?.handicapIndex).toBe(14.2);
    const comparison = loadComparisons(db, "u", [pippy!.facilityId], "2026-10-06").get(pippy!.facilityId);
    expect(comparison?.standing).toBeNull();
    expect(comparison?.suited).toBeNull();
  });

  it("reads a personal 18Birdies download and ignores an unknown file", () => {
    const parsed = parseBirdiesDownload({
      handicapIndex: 16,
      rounds: [{ course: "Cabot Cliffs", date: "2026-06-01", holes: 18, score: 80, id: "one" }],
    });
    expect(parsed?.memberId).toBe("download");
    expect(parsed?.rounds[0]?.externalRoundId).toBe("one");
    expect(parseBirdiesDownload({ rounds: [] })).toBeNull();
    expect(parseBirdiesDownload({ notes: "not a download" })).toBeNull();
  });

  it("refuses a live score pull until a partner client exists, and still has no score endpoint", async () => {
    const saved = {
      golfId: process.env.GOLFCANADA_CLIENT_ID,
      golfSecret: process.env.GOLFCANADA_CLIENT_SECRET,
    };
    delete process.env.GOLFCANADA_CLIENT_ID;
    delete process.env.GOLFCANADA_CLIENT_SECRET;
    try {
      await expect(pullGolfCanada("1234")).rejects.toBeInstanceOf(ScoreFeedClosed);
      await expect(pullGolfCanada("1234")).rejects.toMatchObject({ reason: "agreement" });
      process.env.GOLFCANADA_CLIENT_ID = "client";
      process.env.GOLFCANADA_CLIENT_SECRET = "secret";
      await expect(pullGolfCanada("1234")).rejects.toMatchObject({ reason: "endpoint" });
    } finally {
      for (const [key, value] of [
        ["GOLFCANADA_CLIENT_ID", saved.golfId],
        ["GOLFCANADA_CLIENT_SECRET", saved.golfSecret],
      ] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
