import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createUser, regenerateShareToken, setHeadlineProvince, setShareEnabled, shareByToken } from "./auth";
import {
  applyMarkToggle,
  countRounds,
  countShareLinks,
  deleteAccount,
  getFacility,
  openDatabase,
  readSummary,
} from "./db";

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

describe("stored summary and account deletion", () => {
  it("updates the summary when a course is marked and unmarked", () => {
    const db = database();
    createUser(db, { id: "u", email: "golfer@example.com", password: "longpassword", createdAt: "2026-10-06T12:00:00.000Z" });
    setHeadlineProvince(db, "u", "NL");
    const pippy = getFacility(db, "nl-pippy-park-golf-course");
    expect(pippy).not.toBeNull();
    applyMarkToggle(db, {
      userId: "u",
      facilityId: pippy!.facilityId,
      turnOn: true,
      today: "2026-10-06",
      newId: "mark-1",
    });
    const summary = readSummary(db, "u", "NL");
    expect(summary).toMatchObject({ played_count: 1, this_year_count: 1, earlier_count: 0 });
    expect(summary!.total_count).toBeGreaterThan(1);

    applyMarkToggle(db, {
      userId: "u",
      facilityId: pippy!.facilityId,
      turnOn: false,
      today: "2026-10-06",
      newId: "unused",
    });
    expect(readSummary(db, "u", "NL")?.played_count).toBe(0);
  });

  it("rolls back a failed round insert so the percentage is not half-applied", () => {
    const db = database();
    createUser(db, { id: "u", email: "golfer@example.com", password: "longpassword", createdAt: "2026-10-06T12:00:00.000Z" });
    const original = db.prepare("INSERT INTO rounds (id, user_id, facility_id, played_on, holes, score, score_differential, source, raw_course_name, raw_association_course_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const tx = db.transaction(() => {
      original.run("r1", "u", "nl-pippy-park-golf-course", "2026-06-01", 18, 80, null, "import", null, null);
      throw new Error("disk failed");
    });
    expect(() => tx()).toThrow(/disk failed/);
    expect(countRounds(db, "u")).toBe(0);
    expect(readSummary(db, "u", "NL")).toBeNull();
  });

  it("deletes rounds and the share link with the account", () => {
    const db = database();
    createUser(db, { id: "u", email: "golfer@example.com", password: "longpassword", createdAt: "2026-10-06T12:00:00.000Z" });
    applyMarkToggle(db, {
      userId: "u",
      facilityId: "nl-pippy-park-golf-course",
      turnOn: true,
      today: "2026-10-06",
      newId: "mark-1",
    });
    setShareEnabled(db, "u", true, "2026-10-06T12:00:00.000Z");
    expect(countShareLinks(db, "u")).toBe(1);
    deleteAccount(db, "u");
    expect(countRounds(db, "u")).toBe(0);
    expect(countShareLinks(db, "u")).toBe(0);
    expect(db.prepare("SELECT id FROM users WHERE id = ?").get("u")).toBeUndefined();
    expect(getFacility(db, "nl-pippy-park-golf-course")?.officialName).toBe("Pippy Park Golf Course");
  });

  it("invalidates the old share link when the token is regenerated", () => {
    const db = database();
    createUser(db, { id: "u", email: "golfer@example.com", password: "longpassword", createdAt: "2026-10-06T12:00:00.000Z" });
    const first = setShareEnabled(db, "u", true, "2026-10-06T12:00:00.000Z");
    expect(shareByToken(db, first)?.enabled).toBe(true);
    const second = regenerateShareToken(db, "u", "2026-10-07T12:00:00.000Z");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(shareByToken(db, first)).toBeNull();
    expect(shareByToken(db, second!)?.enabled).toBe(true);
    expect(regenerateShareToken(db, "nobody", "2026-10-07T12:00:00.000Z")).toBeNull();
  });
});
