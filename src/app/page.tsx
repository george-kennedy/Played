import { chooseProvince, setPlayed } from "@/app/actions";
import { CoverageBlock, provinceLabel } from "@/components/coverage-block";
import { CoursePinMap } from "@/components/course-pin-map";
import { OpenPinGlyph, PlayedPinGlyph } from "@/components/pin-glyphs";
import type { PinCourse, PinMapLabels } from "@/components/pin-course";
import { halifaxToday } from "@/lib/dates";
import { translate } from "@/lib/i18n";
import { PROVINCES, type Province } from "@/lib/types";
import { getDb, listAccountRounds, listFacilities, readStatuses, readSummary, rebuildSummary, type FacilityStatus } from "@/lib/db";
import { hasMapCoordinates, splitMapFacilities } from "@/lib/map-pins";
import { currentLocale, currentUser } from "@/lib/session";
import type { Facility } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; error?: string }>;
}) {
  const locale = await currentLocale();
  const user = await currentUser();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const params = await searchParams;
  const atlantic = params.scope === "atlantic";

  if (!user) {
    return (
      <div className="stack">
        <h1>{t("brand")}</h1>
        <p className="lede">{t("home.signedOut")}</p>
        <p className="inline">
          <a className="button" href="/sign-up">{t("nav.signUp")}</a>
          <a className="button secondary" href="/sign-in">{t("nav.signIn")}</a>
        </p>
      </div>
    );
  }

  if (!user.email_verified_at) {
    return (
      <div className="stack">
        <h1>{t("auth.verifyTitle")}</h1>
        <p>{t("account.verifyNeeded")}</p>
        <a className="button" href="/verify-email">{t("auth.verifyButton")}</a>
      </div>
    );
  }

  if (!user.headline_province) {
    return (
      <form className="stack card" action={chooseProvince}>
        <h1>{t("home.provinceTitle")}</h1>
        <p className="help">{t("home.provinceHelp")}</p>
        {PROVINCES.map((province) => (
          <label key={province} className="inline">
            <input type="radio" name="province" value={province} required />
            {t(`province.${province}`)}
          </label>
        ))}
        <button type="submit">{t("home.saveProvince")}</button>
      </form>
    );
  }

  const province = user.headline_province;
  const scope = atlantic ? "ATLANTIC" : province;
  const db = getDb();
  if (!readSummary(db, user.id, scope)) rebuildSummary(db, user.id);
  const summary = readSummary(db, user.id, scope) ?? {
    scope,
    played_count: 0,
    total_count: 0,
    this_year_count: 0,
    earlier_count: 0,
    percentage: 0,
  };
  const statuses = new Map(readStatuses(db, user.id).map((status) => [status.facilityId, status]));
  const facilities = listFacilities(db)
    .filter((facility) => (atlantic ? true : facility.province === province))
    .sort((a, b) => a.officialName.localeCompare(b.officialName));
  const played = facilities.filter((facility) => statuses.has(facility.facilityId));
  const notPlayed = facilities.filter((facility) => !statuses.has(facility.facilityId));
  const { pinned, unpinned } = splitMapFacilities(facilities);
  const roundsByFacility = new Map<string, PinCourse["rounds"]>();
  for (const round of listAccountRounds(db, user.id)) {
    if (!round.facilityId) continue;
    const line = {
      id: round.id,
      playedOn: round.playedOn,
      score: round.score,
      holesLabel: t("course.holes", { count: round.holes }),
    };
    const bucket = roundsByFacility.get(round.facilityId);
    if (bucket) bucket.push(line);
    else roundsByFacility.set(round.facilityId, [line]);
  }
  const returnTo = atlantic ? "/?scope=atlantic" : "/";
  const pins: PinCourse[] = pinned.map((facility) => {
    const access = facility.access === "public" ? t("access.public") : t("access.private");
    const place = [facility.place, provinceLabel(locale, facility.province)].filter(Boolean).join(", ");
    return {
      facilityId: facility.facilityId,
      name: facility.officialName,
      placeLine: `${place} · ${access}`,
      played: statuses.has(facility.facilityId),
      latitude: facility.latitude,
      longitude: facility.longitude,
      defaultHoles: facility.holeCount >= 18 ? "18" : "9",
      markRoundId: statuses.get(facility.facilityId)?.markRoundId ?? null,
      rounds: roundsByFacility.get(facility.facilityId) ?? [],
    };
  });
  const labels: PinMapLabels = {
    played: t("home.played"),
    notPlayed: t("home.notPlayed"),
    markOn: t("home.markOn"),
    markOff: t("home.markOff"),
    playedKeep: t("home.playedKeep"),
    rounds: t("course.rounds"),
    noRounds: t("course.noRounds"),
    addRound: t("course.addRound"),
    date: t("course.date"),
    holes: t("directory.holes"),
    score: t("course.score"),
    scoreOptional: t("course.scoreOptional"),
    secondRound: t("course.secondRound"),
    courseLink: t("map.courseLink"),
    loading: t("map.loading"),
    failed: t("map.failed"),
    region: t("map.region"),
    empty: t("map.empty"),
  };
  const errorText = roundError(locale, params.error);

  return (
    <div className="stack">
      <h1>{provinceLabel(locale, scope)}</h1>
      <p className="lede">{t("home.lede")}</p>
      <div className="switch" role="group" aria-label={t("home.denominator")}>
        <a href="/" aria-current={atlantic ? undefined : "page"}>{provinceLabel(locale, province)}</a>
        <a href="/?scope=atlantic" aria-current={atlantic ? "page" : undefined}>{t("province.atlantic")}</a>
      </div>
      {errorText ? <p className="error">{errorText}</p> : null}
      <section className="stack" aria-label={t("map.region")}>
        <a className="skip-map" href="#course-lists">{t("map.skip")}</a>
        <ul className="legend map-legend" aria-label={t("map.legend")}>
          <li><PlayedPinGlyph /> {t("home.played")}</li>
          <li><OpenPinGlyph /> {t("home.notPlayed")}</li>
        </ul>
        <CoursePinMap key={scope} courses={pins} labels={labels} today={halifaxToday()} returnTo={returnTo} />
        {unpinned.length > 0 ? (
          <p className="help">{t("map.unpinned")} {unpinned.map((facility) => facility.officialName).join(", ")}</p>
        ) : null}
      </section>
      <CoverageBlock locale={locale} summary={summary} label={provinceLabel(locale, scope)} />
      <p><a href="/import">{t("home.importLink")}</a></p>
      <div id="course-lists" tabIndex={-1} className="stack">
        <CourseSection
          title={t("home.notPlayed")}
          empty={t("home.emptyNot")}
          facilities={notPlayed}
          statuses={statuses}
          locale={locale}
          returnTo={returnTo}
          mode="on"
        />
        <CourseSection
          title={t("home.played")}
          empty={t("home.emptyPlayed")}
          facilities={played}
          statuses={statuses}
          locale={locale}
          returnTo={returnTo}
          mode="played"
        />
      </div>
    </div>
  );
}

function roundError(locale: "en" | "fr", error: string | undefined): string | null {
  if (error === "future_date") return translate(locale, "error.future");
  if (error === "conflict") return translate(locale, "error.conflict");
  if (error === "bad_score") return translate(locale, "error.badScore");
  if (error === "bad_holes") return translate(locale, "error.badHoles");
  if (error === "bad_date") return translate(locale, "error.badDate");
  return null;
}

function CourseSection({
  title,
  empty,
  facilities,
  statuses,
  locale,
  returnTo,
  mode,
}: {
  title: string;
  empty: string;
  facilities: Facility[];
  statuses: Map<string, FacilityStatus>;
  locale: "en" | "fr";
  returnTo: string;
  mode: "on" | "played";
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <section>
      <h2>{title} <span className="muted">{facilities.length}</span></h2>
      {facilities.length === 0 ? <p>{empty}</p> : null}
      <ul className="course-list">
        {facilities.map((facility) => {
          const status = statuses.get(facility.facilityId);
          const access = facility.access === "public" ? t("access.public") : t("access.private");
          return (
            <li key={facility.facilityId} className="course-row">
              <div>
                <a className="course-name" href={`/courses/${facility.facilityId}`}>{facility.officialName}</a>
                <p className="meta">
                  {[facility.place, provinceLabel(locale, facility.province as Province)].filter(Boolean).join(", ")}
                  {" · "}
                  {access}
                  {hasMapCoordinates(facility) ? "" : ` · ${t("directory.distanceUnavailable")}`}
                </p>
              </div>
              {mode === "on" ? (
                <form action={setPlayed}>
                  <input type="hidden" name="facilityId" value={facility.facilityId} />
                  <input type="hidden" name="intent" value="on" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button type="submit">{t("home.markOn")}</button>
                </form>
              ) : status?.markRoundId ? (
                <form action={setPlayed}>
                  <input type="hidden" name="facilityId" value={facility.facilityId} />
                  <input type="hidden" name="intent" value="off" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <button className="secondary" type="submit">{t("home.markOff")}</button>
                </form>
              ) : (
                <span className="pill">{t("home.playedKeep")}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
