import { chooseProvince, setPlayed } from "@/app/actions";
import { CoverageBlock, provinceLabel } from "@/components/coverage-block";
import { CoursePinMap } from "@/components/course-pin-map";
import { OpenPinGlyph, PlayedPinGlyph } from "@/components/pin-glyphs";
import type { PinCourse, PinMapLabels } from "@/components/pin-course";
import { halifaxToday } from "@/lib/dates";
import { distanceKm, placeById, PLACES } from "@/lib/distance";
import { translate } from "@/lib/i18n";
import { PROVINCES, type Province } from "@/lib/types";
import { matchesHoles, matchesRanking } from "@/lib/list-filters";
import { getDb, listAccountRounds, listFacilities, readStatuses, readSummary, rebuildSummary } from "@/lib/db";
import { splitMapFacilities } from "@/lib/map-pins";
import { currentLocale, currentUser } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const locale = await currentLocale();
  const user = await currentUser();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const params = await searchParams;
  const accessFilter = params.access === "public" || params.access === "private" ? params.access : "";
  const rankingFilter = params.ranking ?? "";
  const holesFilter = params.holes === "9" || params.holes === "18" ? params.holes : "";
  const playedFilter = params.played === "played" || params.played === "unplayed" ? params.played : "";
  const queryText = (params.q ?? "").trim();
  const showAll = params.show === "all";
  const near = placeById(params.place);

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

  const homeProvince = user.headline_province;
  const requested = params.view;
  const view: Province | "CANADA" =
    requested === "canada"
      ? "CANADA"
      : requested && (PROVINCES as readonly string[]).includes(requested)
        ? (requested as Province)
        : homeProvince;
  const db = getDb();
  if (!readSummary(db, user.id, view)) rebuildSummary(db, user.id);
  const summary = readSummary(db, user.id, view) ?? {
    scope: view,
    played_count: 0,
    total_count: 0,
    this_year_count: 0,
    earlier_count: 0,
    percentage: 0,
  };
  const statuses = new Map(readStatuses(db, user.id).map((status) => [status.facilityId, status]));
  const needle = queryText.toLowerCase();
  const inView = listFacilities(db)
    .filter((facility) => (view === "CANADA" ? true : facility.province === view))
    .filter((facility) => {
      if (needle && !`${facility.officialName} ${facility.place ?? ""}`.toLowerCase().includes(needle)) return false;
      if (accessFilter && facility.access !== accessFilter) return false;
      if (!matchesHoles(facility.holeCount, holesFilter)) return false;
      if (!matchesRanking(facility.facilityId, rankingFilter)) return false;
      const isPlayed = statuses.has(facility.facilityId);
      if (playedFilter === "played") return isPlayed;
      if (playedFilter === "unplayed") return !isPlayed;
      return true;
    });
  const ranked = inView
    .map((facility) => ({
      facility,
      km:
        near && facility.latitude != null && facility.longitude != null
          ? distanceKm(near.latitude, near.longitude, facility.latitude, facility.longitude)
          : null,
    }))
    .sort((a, b) => {
      if (near) {
        if (a.km === null && b.km === null) return a.facility.officialName.localeCompare(b.facility.officialName);
        if (a.km === null) return 1;
        if (b.km === null) return -1;
        return a.km - b.km;
      }
      return a.facility.officialName.localeCompare(b.facility.officialName);
    });
  const { pinned, unpinned } = splitMapFacilities(ranked.map((row) => row.facility));
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
  const kept = new URLSearchParams();
  if (view === "CANADA") kept.set("view", "canada");
  else if (view !== homeProvince) kept.set("view", view);
  if (queryText) kept.set("q", queryText);
  if (playedFilter) kept.set("played", playedFilter);
  if (accessFilter) kept.set("access", accessFilter);
  if (rankingFilter) kept.set("ranking", rankingFilter);
  if (holesFilter) kept.set("holes", holesFilter);
  if (near) kept.set("place", near.id);
  if (showAll) kept.set("show", "all");
  const returnTo = `/${kept.toString() ? `?${kept.toString()}` : ""}`;
  const chipHref = (nextView: Province | "CANADA") => {
    const next = new URLSearchParams(kept);
    next.delete("view");
    next.delete("show");
    if (nextView === "CANADA") next.set("view", "canada");
    else if (nextView !== homeProvince) next.set("view", nextView);
    const search = next.toString();
    return search ? `/?${search}` : "/";
  };
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
  const visible = showAll ? ranked : ranked.slice(0, 40);

  return (
    <div className="stack">
      <h1>{provinceLabel(locale, view)}</h1>
      <p className="lede">{t("home.lede")}</p>
      <CoverageBlock locale={locale} summary={summary} label={provinceLabel(locale, view)} />
      <div className="switch" role="group" aria-label={t("directory.province")}>
        <a href={chipHref("CANADA")} aria-current={view === "CANADA" ? "page" : undefined}>{t("province.canada")}</a>
        {PROVINCES.map((code) => (
          <a key={code} href={chipHref(code)} aria-current={view === code ? "page" : undefined}>
            {t(`province.${code}`)}
          </a>
        ))}
      </div>
      {errorText ? <p className="error">{errorText}</p> : null}
      <section className="stack" aria-label={t("map.region")}>
        <a className="skip-map" href="#course-lists">{t("map.skip")}</a>
        <ul className="legend map-legend" aria-label={t("map.legend")}>
          <li><PlayedPinGlyph /> {t("home.played")}</li>
          <li><OpenPinGlyph /> {t("home.notPlayed")}</li>
        </ul>
        <CoursePinMap key={view + kept.toString()} courses={pins} labels={labels} today={halifaxToday()} returnTo={returnTo} />
        {unpinned.length > 0 && unpinned.length <= 8 ? (
          <p className="help">{t("map.unpinned")} {unpinned.map((facility) => facility.officialName).join(", ")}</p>
        ) : null}
      </section>
      <form className="filters card" method="get">
        {view === "CANADA" ? <input type="hidden" name="view" value="canada" /> : null}
        {view !== "CANADA" && view !== homeProvince ? <input type="hidden" name="view" value={view} /> : null}
        <label>
          {t("directory.search")}
          <input name="q" defaultValue={queryText} />
        </label>
        <label>
          {t("directory.played")}
          <select name="played" defaultValue={playedFilter}>
            <option value="">{t("directory.any")}</option>
            <option value="played">{t("home.played")}</option>
            <option value="unplayed">{t("home.notPlayed")}</option>
          </select>
        </label>
        <label>
          {t("directory.access")}
          <select name="access" defaultValue={accessFilter}>
            <option value="">{t("directory.any")}</option>
            <option value="public">{t("access.public")}</option>
            <option value="private">{t("access.private")}</option>
          </select>
        </label>
        <label>
          {t("directory.ranking")}
          <select name="ranking" defaultValue={rankingFilter}>
            <option value="">{t("directory.any")}</option>
            <option value="national">{t("directory.rankingNational")}</option>
            <option value="public">{t("directory.rankingPublic")}</option>
          </select>
        </label>
        <label>
          {t("directory.holes")}
          <select name="holes" defaultValue={holesFilter}>
            <option value="">{t("directory.any")}</option>
            <option value="9">{t("directory.holes9")}</option>
            <option value="18">{t("directory.holes18")}</option>
          </select>
        </label>
        <label>
          {t("directory.place")}
          <select name="place" defaultValue={near?.id ?? ""}>
            <option value="">{t("directory.any")}</option>
            {PLACES.map((item) => (
              <option key={item.id} value={item.id}>{t(`place.${item.id}`)}</option>
            ))}
          </select>
        </label>
        <button type="submit">{t("directory.apply")}</button>
      </form>
      <p className="help">{t("directory.rankingHelp")}</p>
      <div id="course-lists" tabIndex={-1}>
        <h2>{t("directory.title")} <span className="muted">{ranked.length}</span></h2>
        {ranked.length === 0 ? <p>{t("directory.empty")}</p> : null}
        <ul className="course-list">
          {visible.map(({ facility, km }) => {
            const status = statuses.get(facility.facilityId);
            const access = facility.access === "public" ? t("access.public") : t("access.private");
            const distance = !near
              ? null
              : km === null
                ? t("directory.distanceUnavailable")
                : t("directory.km", { km: km >= 10 ? Math.round(km) : km.toFixed(1) });
            return (
              <li key={facility.facilityId} className="course-row">
                <div>
                  <a className="course-name" href={`/courses/${facility.facilityId}`}>{facility.officialName}</a>
                  <p className="meta">
                    {[facility.place, provinceLabel(locale, facility.province)].filter(Boolean).join(", ")}
                    {" · "}
                    {access}
                    {distance ? ` · ${distance}` : ""}
                    {status ? ` · ${t("home.played")}` : ""}
                  </p>
                </div>
                {status?.markRoundId ? (
                  <form action={setPlayed}>
                    <input type="hidden" name="facilityId" value={facility.facilityId} />
                    <input type="hidden" name="intent" value="off" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button className="secondary" type="submit">{t("home.markOff")}</button>
                  </form>
                ) : status ? (
                  <span className="pill">{t("home.playedKeep")}</span>
                ) : (
                  <form action={setPlayed}>
                    <input type="hidden" name="facilityId" value={facility.facilityId} />
                    <input type="hidden" name="intent" value="on" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit">{t("home.markOn")}</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {!showAll && ranked.length > 40 ? (
          <p className="help">
            {t("directory.showing", { shown: 40, total: ranked.length })}{" "}
            <a href={`${returnTo}${returnTo.includes("?") ? "&" : "?"}show=all`}>{t("directory.showAll")}</a>
          </p>
        ) : null}
      </div>
      <p><a href="/connect">{t("home.connectLink")}</a></p>
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

