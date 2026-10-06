import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createUser, setHeadlineProvince, setShareEnabled } from "./auth";
import {
  applyImport,
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
  it("updates the summary when a course is marked, without leaving a partial import", () => {
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

    const csv = [
      "played_on,course_name,holes,score",
      "2026-06-01,Pippy Park Golf Course,18,80",
      "not-a-date,Pippy Park Golf Course,18,81",
    ].join("\n");
    const review = applyImport(db, {
      userId: "u",
      csv,
      newId: (() => {
        let n = 0;
        return () => `imp-${++n}`;
      })(),
      runId: "run-1",
      createdAt: "2026-10-06T12:00:00.000Z",
    });
    expect(review.acceptedMatched).toBe(1);
    expect(review.failures[0]?.reason).toBe("bad_date");
    expect(readSummary(db, "u", "NL")?.played_count).toBe(1);
    expect(countRounds(db, "u")).toBe(1);
  });

  it("rolls back a failed import so the percentage is not half-applied", () => {
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
});
