import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  allScopes,
  coverage,
  denominatorForScope,
  publicShare,
} from "./coverage";
import { halifaxYear } from "./dates";
import type { ScoreProvider } from "./providers";
import { courseComparison, shiftIsoDate, SUITED_MONTHS, type CourseComparison } from "./standing";
import { planIncoming, type IncomingRound } from "./sync";
import { addManualRound } from "./manual";
import { toggleMark } from "./mark";
import type { Access, Facility, HoleCount, Province, PublicShare, Round, RoundSource } from "./types";
import { isProvince } from "./names";

type SeedFile = {
  facilities: Array<{
    facility_id: string;
    official_name: string;
    province: Province;
    place?: string | null;
    latitude?: number;
    longitude?: number;
    hole_count: number;
    access: Access;
    association_course_id?: string;
    association_course_ids?: string[];
    rating?: number;
    slope?: number;
    source_url: string;
    merged_routings?: boolean;
  }>;
};

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: string | null;
  headline_province: Province | null;
  locale: "en" | "fr";
  place_id: string | null;
  created_at: string;
};

type RoundRow = {
  id: string;
  user_id: string;
  facility_id: string | null;
  played_on: string;
  holes: number;
  score: number | null;
  score_differential: number | null;
  source: RoundSource;
  raw_course_name: string | null;
  raw_association_course_id: string | null;
};

export type SummaryRow = {
  scope: Province | "CANADA";
  played_count: number;
  total_count: number;
  this_year_count: number;
  earlier_count: number;
  percentage: number | null;
};

export type FacilityStatus = {
  facilityId: string;
  firstPlayedOn: string;
  markRoundId: string | null;
  roundCount: number;
};

function mapRound(row: RoundRow): Round {
  return {
    id: row.id,
    userId: row.user_id,
    facilityId: row.facility_id,
    playedOn: row.played_on,
    holes: row.holes as HoleCount,
    score: row.score,
    scoreDifferential: row.score_differential,
    source: row.source,
    rawCourseName: row.raw_course_name,
    rawAssociationCourseId: row.raw_association_course_id,
  };
}

function mapFacility(row: {
  facility_id: string;
  official_name: string;
  province: string;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  hole_count: number;
  access: string;
  association_course_id: string | null;
  association_course_ids: string;
  rating: number | null;
  slope: number | null;
  source_url: string;
  merged_routings: number;
}): Facility {
  return {
    facilityId: row.facility_id,
    officialName: row.official_name,
    province: row.province as Province,
    place: row.place,
    latitude: row.latitude,
    longitude: row.longitude,
    holeCount: row.hole_count,
    access: row.access as Access,
    associationCourseId: row.association_course_id,
    associationCourseIds: JSON.parse(row.association_course_ids) as string[],
    rating: row.rating,
    slope: row.slope,
    sourceUrl: row.source_url,
    mergedRoutings: row.merged_routings === 1,
  };
}

export function loadSeedFacilities(): SeedFile["facilities"] {
  const file = path.join(process.cwd(), "data", "facilities.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as SeedFile;
  return parsed.facilities;
}

export function migrate(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email_verified_at TEXT,
      headline_province TEXT,
      locale TEXT NOT NULL DEFAULT 'en',
      place_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS facilities (
      facility_id TEXT PRIMARY KEY,
      official_name TEXT NOT NULL,
      province TEXT NOT NULL,
      place TEXT,
      latitude REAL,
      longitude REAL,
      hole_count INTEGER NOT NULL,
      access TEXT NOT NULL,
      association_course_id TEXT,
      association_course_ids TEXT NOT NULL,
      rating REAL,
      slope INTEGER,
      source_url TEXT NOT NULL,
      merged_routings INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_id TEXT REFERENCES facilities(facility_id),
      played_on TEXT NOT NULL,
      holes INTEGER NOT NULL,
      score INTEGER,
      score_differential REAL,
      source TEXT NOT NULL,
      raw_course_name TEXT,
      raw_association_course_id TEXT
    );
    CREATE INDEX IF NOT EXISTS rounds_user ON rounds(user_id, facility_id);
    CREATE TABLE IF NOT EXISTS facility_status (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_id TEXT NOT NULL,
      first_played_on TEXT NOT NULL,
      mark_round_id TEXT,
      round_count INTEGER NOT NULL,
      PRIMARY KEY (user_id, facility_id)
    );
    CREATE TABLE IF NOT EXISTS coverage_summaries (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      played_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      this_year_count INTEGER NOT NULL,
      earlier_count INTEGER NOT NULL,
      percentage REAL,
      PRIMARY KEY (user_id, scope)
    );
    CREATE TABLE IF NOT EXISTS share_links (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS external_links (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_id TEXT,
      status TEXT NOT NULL,
      handicap_index REAL,
      last_sync_at TEXT,
      consented_at TEXT NOT NULL,
      PRIMARY KEY (user_id, provider)
    );
    CREATE INDEX IF NOT EXISTS rounds_facility_date ON rounds(facility_id, played_on);
  `);
  ensureColumn(db, "rounds", "provider", "TEXT");
  ensureColumn(db, "rounds", "external_round_id", "TEXT");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS rounds_external
      ON rounds(user_id, provider, external_round_id)
      WHERE external_round_id IS NOT NULL;
  `);
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function seedFacilities(db: Database.Database, rows = loadSeedFacilities()): void {
  const insert = db.prepare(`
    INSERT INTO facilities (
      facility_id, official_name, province, place, latitude, longitude, hole_count, access,
      association_course_id, association_course_ids, rating, slope, source_url, merged_routings
    ) VALUES (
      @facility_id, @official_name, @province, @place, @latitude, @longitude, @hole_count, @access,
      @association_course_id, @association_course_ids, @rating, @slope, @source_url, @merged_routings
    )
    ON CONFLICT(facility_id) DO UPDATE SET
      official_name = excluded.official_name,
      province = excluded.province,
      place = excluded.place,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      hole_count = excluded.hole_count,
      access = excluded.access,
      association_course_id = excluded.association_course_id,
      association_course_ids = excluded.association_course_ids,
      rating = excluded.rating,
      slope = excluded.slope,
      source_url = excluded.source_url,
      merged_routings = excluded.merged_routings
  `);
  const tx = db.transaction((items: SeedFile["facilities"]) => {
    for (const row of items) {
      insert.run({
        facility_id: row.facility_id,
        official_name: row.official_name,
        province: row.province,
        place: row.place ?? null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        hole_count: row.hole_count,
        access: row.access,
        association_course_id: row.association_course_id ?? null,
        association_course_ids: JSON.stringify(row.association_course_ids ?? (row.association_course_id ? [row.association_course_id] : [])),
        rating: row.rating ?? null,
        slope: row.slope ?? null,
        source_url: row.source_url,
        merged_routings: row.merged_routings ? 1 : 0,
      });
    }
  });
  tx(rows);
}

export function openDatabase(filename: string): Database.Database {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedFacilities(db);
  return db;
}

const globalForDb = globalThis as { playedDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.playedDb) {
    const filename = process.env.PLAYED_DB ?? path.join(process.cwd(), "data", "played.sqlite");
    globalForDb.playedDb = openDatabase(filename);
  }
  return globalForDb.playedDb;
}

export function listFacilities(db: Database.Database): Facility[] {
  const rows = db.prepare("SELECT * FROM facilities").all() as Parameters<typeof mapFacility>[0][];
  return rows.map(mapFacility);
}

export function getFacility(db: Database.Database, facilityId: string): Facility | null {
  const row = db.prepare("SELECT * FROM facilities WHERE facility_id = ?").get(facilityId) as
    | Parameters<typeof mapFacility>[0]
    | undefined;
  return row ? mapFacility(row) : null;
}

function listUserRounds(db: Database.Database, userId: string): Round[] {
  const rows = db.prepare("SELECT * FROM rounds WHERE user_id = ?").all(userId) as RoundRow[];
  return rows.map(mapRound);
}

export function listFacilityRounds(db: Database.Database, userId: string, facilityId: string): Round[] {
  const rows = db
    .prepare("SELECT * FROM rounds WHERE user_id = ? AND facility_id = ? ORDER BY played_on, holes")
    .all(userId, facilityId) as RoundRow[];
  return rows.map(mapRound);
}

export function listAccountRounds(db: Database.Database, userId: string): Round[] {
  const rows = db
    .prepare(
      "SELECT * FROM rounds WHERE user_id = ? AND facility_id IS NOT NULL ORDER BY facility_id, played_on, holes",
    )
    .all(userId) as RoundRow[];
  return rows.map(mapRound);
}

export function listUnmatched(db: Database.Database, userId: string): Round[] {
  const rows = db
    .prepare("SELECT * FROM rounds WHERE user_id = ? AND facility_id IS NULL ORDER BY played_on")
    .all(userId) as RoundRow[];
  return rows.map(mapRound);
}

function insertRound(db: Database.Database, round: Round): void {
  db.prepare(
    `INSERT INTO rounds (
      id, user_id, facility_id, played_on, holes, score, score_differential, source,
      raw_course_name, raw_association_course_id, provider, external_round_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    round.id,
    round.userId,
    round.facilityId,
    round.playedOn,
    round.holes,
    round.score,
    round.scoreDifferential,
    round.source,
    round.rawCourseName,
    round.rawAssociationCourseId,
    round.provider ?? null,
    round.externalRoundId ?? null,
  );
}

export function rebuildSummary(db: Database.Database, userId: string, year = halifaxYear()): void {
  const facilities = listFacilities(db);
  const rounds = listUserRounds(db, userId).filter((round) => round.facilityId);
  const replaceSummary = db.prepare(
    `INSERT INTO coverage_summaries (
      user_id, scope, played_count, total_count, this_year_count, earlier_count, percentage
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, scope) DO UPDATE SET
      played_count = excluded.played_count,
      total_count = excluded.total_count,
      this_year_count = excluded.this_year_count,
      earlier_count = excluded.earlier_count,
      percentage = excluded.percentage`,
  );
  for (const scope of allScopes()) {
    const result = coverage({
      facilities,
      rounds,
      denominator: denominatorForScope(scope),
      year,
    });
    replaceSummary.run(
      userId,
      scope,
      result.played,
      result.total,
      result.thisYear,
      result.earlier,
      result.percentage,
    );
  }

  db.prepare("DELETE FROM facility_status WHERE user_id = ?").run(userId);
  const insertStatus = db.prepare(
    `INSERT INTO facility_status (user_id, facility_id, first_played_on, mark_round_id, round_count)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const grouped = new Map<string, { first: string; markRoundId: string | null; count: number }>();
  for (const round of rounds) {
    if (!round.facilityId) continue;
    const current = grouped.get(round.facilityId);
    if (!current) {
      grouped.set(round.facilityId, {
        first: round.playedOn,
        markRoundId: round.source === "mark" ? round.id : null,
        count: 1,
      });
      continue;
    }
    current.count += 1;
    if (round.playedOn < current.first) current.first = round.playedOn;
    if (round.source === "mark") current.markRoundId = round.id;
  }
  for (const [facilityId, status] of grouped) {
    insertStatus.run(userId, facilityId, status.first, status.markRoundId, status.count);
  }
}

export function readSummary(db: Database.Database, userId: string, scope: Province | "CANADA"): SummaryRow | null {
  const row = db
    .prepare(
      `SELECT scope, played_count, total_count, this_year_count, earlier_count, percentage
       FROM coverage_summaries WHERE user_id = ? AND scope = ?`,
    )
    .get(userId, scope) as SummaryRow | undefined;
  return row ?? null;
}

export function readStatuses(db: Database.Database, userId: string): FacilityStatus[] {
  const rows = db
    .prepare(
      `SELECT facility_id, first_played_on, mark_round_id, round_count
       FROM facility_status WHERE user_id = ?`,
    )
    .all(userId) as Array<{
    facility_id: string;
    first_played_on: string;
    mark_round_id: string | null;
    round_count: number;
  }>;
  return rows.map((row) => ({
    facilityId: row.facility_id,
    firstPlayedOn: row.first_played_on,
    markRoundId: row.mark_round_id,
    roundCount: row.round_count,
  }));
}

export function applyMarkToggle(
  db: Database.Database,
  input: { userId: string; facilityId: string; turnOn: boolean; today: string; newId: string },
): void {
  const facility = getFacility(db, input.facilityId);
  if (!facility) throw new Error("unknown_facility");
  const tx = db.transaction(() => {
    const existing = listFacilityRounds(db, input.userId, input.facilityId);
    const result = toggleMark({
      rounds: existing,
      facilityId: facility.facilityId,
      facilityHoleCount: facility.holeCount,
      today: input.today,
      turnOn: input.turnOn,
      userId: input.userId,
      newId: input.newId,
    });
    for (const id of result.removedIds) {
      db.prepare("DELETE FROM rounds WHERE id = ? AND user_id = ? AND source = 'mark'").run(id, input.userId);
    }
    if (result.created) insertRound(db, result.created);
    rebuildSummary(db, input.userId);
  });
  tx();
}

export function applyManualRound(
  db: Database.Database,
  input: {
    userId: string;
    facilityId: string;
    playedOn: string;
    holes: string;
    scoreRaw: string;
    today: string;
    newId: string;
  },
): ReturnType<typeof addManualRound> {
  const facility = getFacility(db, input.facilityId);
  if (!facility) return { ok: false, reason: "bad_date" };
  const existing = listFacilityRounds(db, input.userId, input.facilityId);
  const result = addManualRound({ ...input, existing });
  if (!result.ok) return result;
  const tx = db.transaction(() => {
    insertRound(db, result.round);
    rebuildSummary(db, input.userId);
  });
  tx();
  return result;
}

export type ExternalLink = {
  provider: ScoreProvider;
  externalId: string | null;
  status: "linked" | "disconnected";
  handicapIndex: number | null;
  lastSyncAt: string | null;
};

export function listExternalLinks(db: Database.Database, userId: string): ExternalLink[] {
  const rows = db
    .prepare(
      `SELECT provider, external_id, status, handicap_index, last_sync_at
       FROM external_links WHERE user_id = ? ORDER BY provider`,
    )
    .all(userId) as Array<{
    provider: ScoreProvider;
    external_id: string | null;
    status: "linked" | "disconnected";
    handicap_index: number | null;
    last_sync_at: string | null;
  }>;
  return rows.map((row) => ({
    provider: row.provider,
    externalId: row.external_id,
    status: row.status,
    handicapIndex: row.handicap_index,
    lastSyncAt: row.last_sync_at,
  }));
}

export function applyProviderSync(
  db: Database.Database,
  input: {
    userId: string;
    provider: ScoreProvider;
    externalId: string;
    handicapIndex: number | null;
    rounds: IncomingRound[];
    syncedAt: string;
    newId: () => string;
  },
): { added: number; duplicates: number; unmatched: number } {
  const facilities = listFacilities(db);
  const existing = db
    .prepare(
      `SELECT facility_id, played_on, holes, provider, external_round_id
       FROM rounds WHERE user_id = ?`,
    )
    .all(input.userId) as Array<{
    facility_id: string | null;
    played_on: string;
    holes: number;
    provider: string | null;
    external_round_id: string | null;
  }>;
  const plan = planIncoming({
    facilities,
    existing: existing.map((round) => ({
      facilityId: round.facility_id,
      playedOn: round.played_on,
      holes: round.holes,
      provider: round.provider,
      externalRoundId: round.external_round_id,
    })),
    incoming: input.rounds,
    userId: input.userId,
    provider: input.provider,
    newId: input.newId,
  });
  const tx = db.transaction(() => {
    for (const round of plan.insert) insertRound(db, round);
    db.prepare(
      `INSERT INTO external_links (
         user_id, provider, external_id, status, handicap_index, last_sync_at, consented_at
       ) VALUES (?, ?, ?, 'linked', ?, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET
         external_id = excluded.external_id,
         status = 'linked',
         handicap_index = COALESCE(excluded.handicap_index, external_links.handicap_index),
         last_sync_at = excluded.last_sync_at`,
    ).run(
      input.userId,
      input.provider,
      input.externalId,
      input.handicapIndex,
      input.syncedAt,
      input.syncedAt,
    );
    rebuildSummary(db, input.userId);
  });
  tx();
  return { added: plan.insert.length, duplicates: plan.duplicates, unmatched: plan.unmatched };
}

/** Stops future syncs. Rounds already saved stay on the map. */
export function disconnectProvider(db: Database.Database, userId: string, provider: ScoreProvider): boolean {
  const result = db
    .prepare(`UPDATE external_links SET status = 'disconnected' WHERE user_id = ? AND provider = ? AND status = 'linked'`)
    .run(userId, provider);
  return result.changes > 0;
}

export function loadComparisons(
  db: Database.Database,
  viewerId: string,
  facilityIds: string[],
  today: string,
): Map<string, CourseComparison> {
  const result = new Map<string, CourseComparison>();
  const unique = [...new Set(facilityIds)];
  if (unique.length === 0) return result;
  const viewer = db
    .prepare(
      `SELECT handicap_index FROM external_links
       WHERE user_id = ? AND handicap_index IS NOT NULL
       ORDER BY CASE provider WHEN 'golf_canada' THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .get(viewerId) as { handicap_index: number } | undefined;
  const indexRows = db
    .prepare(
      `SELECT user_id, provider, handicap_index FROM external_links
       WHERE status = 'linked' AND handicap_index IS NOT NULL AND user_id != ?`,
    )
    .all(viewerId) as Array<{ user_id: string; provider: string; handicap_index: number }>;
  const indexes = new Map<string, number>();
  const rank = (provider: string) => (provider === "golf_canada" ? 0 : 1);
  const chosen = new Map<string, { rank: number; index: number }>();
  for (const row of indexRows) {
    const current = chosen.get(row.user_id);
    const next = { rank: rank(row.provider), index: row.handicap_index };
    if (!current || next.rank < current.rank) chosen.set(row.user_id, next);
  }
  for (const [userId, value] of chosen) indexes.set(userId, value.index);
  const start = shiftIsoDate(today, -SUITED_MONTHS);
  const grouped = new Map<string, Array<{ userId: string; playedOn: string; holes: number; differential: number | null }>>();
  for (let offset = 0; offset < unique.length; offset += 200) {
    const slice = unique.slice(offset, offset + 200);
    const placeholders = slice.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT user_id, facility_id, played_on, holes, score_differential
         FROM rounds
         WHERE facility_id IN (${placeholders}) AND played_on >= ? AND played_on <= ?`,
      )
      .all(...slice, start, today) as Array<{
      user_id: string;
      facility_id: string;
      played_on: string;
      holes: number;
      score_differential: number | null;
    }>;
    for (const row of rows) {
      const list = grouped.get(row.facility_id);
      const round = {
        userId: row.user_id,
        playedOn: row.played_on,
        holes: row.holes,
        differential: row.score_differential,
      };
      if (list) list.push(round);
      else grouped.set(row.facility_id, [round]);
    }
  }
  for (const facilityId of unique) {
    result.set(
      facilityId,
      courseComparison({
        viewerId,
        viewerIndex: viewer?.handicap_index ?? null,
        rounds: grouped.get(facilityId) ?? [],
        indexes,
        today,
      }),
    );
  }
  return result;
}

export function deleteAccount(db: Database.Database, userId: string): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM rounds WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM facility_status WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM coverage_summaries WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM share_links WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM external_links WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM tokens WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  tx();
}

export function sharePayload(db: Database.Database, userId: string): PublicShare | null {
  const user = db.prepare("SELECT headline_province FROM users WHERE id = ?").get(userId) as
    | { headline_province: string | null }
    | undefined;
  if (!user?.headline_province || !isProvince(user.headline_province)) return null;
  const provincial = readSummary(db, userId, user.headline_province);
  const canada = readSummary(db, userId, "CANADA");
  if (!provincial || !canada) return null;
  return publicShare({
    headlineProvince: user.headline_province,
    provincial: {
      played: provincial.played_count,
      total: provincial.total_count,
      thisYear: provincial.this_year_count,
      earlier: provincial.earlier_count,
      percentage: provincial.percentage,
    },
    canada: {
      played: canada.played_count,
      total: canada.total_count,
      thisYear: canada.this_year_count,
      earlier: canada.earlier_count,
      percentage: canada.percentage,
    },
  });
}

export function countRounds(db: Database.Database, userId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM rounds WHERE user_id = ?").get(userId) as { n: number };
  return row.n;
}

export function countShareLinks(db: Database.Database, userId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM share_links WHERE user_id = ?").get(userId) as { n: number };
  return row.n;
}
