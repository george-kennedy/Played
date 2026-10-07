import { addRound, setPlayed } from "@/app/actions";
import { provinceLabel } from "@/components/coverage-block";
import { loadCourseMedia } from "@/lib/course-media";
import { halifaxToday } from "@/lib/dates";
import { getDb, getFacility, listFacilityRounds, loadComparisons, readStatuses } from "@/lib/db";
import { rankingLists } from "@/lib/list-filters";
import { bandLabel } from "@/lib/standing";
import { translate } from "@/lib/i18n";
import { currentLocale, currentUser } from "@/lib/session";
import { notFound } from "next/navigation";

export default async function FacilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ facilityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { facilityId } = await params;
  const query = await searchParams;
  const facility = getFacility(getDb(), facilityId);
  if (!facility) notFound();
  const locale = await currentLocale();
  const user = await currentUser();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const access = facility.access === "public" ? t("access.public") : t("access.private");
  const media = await loadCourseMedia(facility);
  const lists = rankingLists(facility.facilityId);
  const signedIn = Boolean(user);
  const rounds = signedIn && user ? listFacilityRounds(getDb(), user.id, facility.facilityId) : [];
  const status = signedIn && user ? readStatuses(getDb(), user.id).find((item) => item.facilityId === facility.facilityId) : undefined;
  const comparison =
    signedIn && user
      ? loadComparisons(getDb(), user.id, [facility.facilityId], halifaxToday()).get(facility.facilityId)
      : undefined;
  const errorKey =
    query.error === "future_date"
      ? "error.future"
      : query.error === "conflict"
        ? "error.conflict"
        : query.error === "bad_score"
          ? "error.badScore"
          : query.error === "bad_holes"
            ? "error.badHoles"
            : query.error === "bad_date"
              ? "error.badDate"
              : null;

  return (
    <article className="stack">
      {media.photoUrl ? (
        <img className="course-page-photo" src={media.photoUrl} alt="" />
      ) : (
        <p className="help">{t("preview.noPhoto")}</p>
      )}
      <h1>{facility.officialName}</h1>
      <p className="lede">
        {[facility.place, provinceLabel(locale, facility.province)].filter(Boolean).join(", ")}
        {" · "}
        {access}
      </p>
      <p>{t("course.holes", { count: facility.holeCount })}</p>
      <section>
        <h2>{t("preview.rankings")}</h2>
        {lists.length === 0 ? <p className="help">{t("preview.noRanking")}</p> : (
          <ul className="facts">
            {lists.map((list) => (
              <li key={list} className="pill">{list === "national" ? t("preview.onNational") : t("preview.onPublic")}</li>
            ))}
          </ul>
        )}
      </section>
      {media.websiteUrl ? (
        <div className="course-actions">
          <a className="button secondary" href={media.websiteUrl} rel="noreferrer">{t("preview.website")}</a>
        </div>
      ) : null}
      {comparison?.standing ? (
        <p>
          {t("course.standing", {
            percent: comparison.standing.percent,
            band: bandLabel(comparison.standing.band),
            count: comparison.standing.count,
          })}
        </p>
      ) : null}
      {comparison?.suited ? (
        <p>{t("course.suited", { band: bandLabel(comparison.suited.band), count: comparison.suited.count })}</p>
      ) : null}
      {facility.rating != null && facility.slope != null ? (
        <p>{t("course.rating", { rating: facility.rating, slope: facility.slope })}</p>
      ) : null}
      <p>{t("course.unclaimed")}</p>
      {errorKey ? <p className="error">{t(errorKey)}</p> : null}
      {signedIn && user ? (
        <div className="stack">
          <form action={setPlayed}>
            <input type="hidden" name="facilityId" value={facility.facilityId} />
            <input type="hidden" name="returnTo" value={`/courses/${facility.facilityId}`} />
            {status?.markRoundId ? (
              <>
                <input type="hidden" name="intent" value="off" />
                <button className="secondary" type="submit">{t("home.markOff")}</button>
              </>
            ) : status ? (
              <span className="pill">{t("home.playedKeep")}</span>
            ) : (
              <>
                <input type="hidden" name="intent" value="on" />
                <button type="submit">{t("home.markOn")}</button>
              </>
            )}
          </form>
          <section>
            <h2>{t("course.rounds")}</h2>
            {rounds.length === 0 ? <p>{t("course.noRounds")}</p> : null}
            <ul className="rounds">
              {rounds.map((round) => (
                <li key={round.id}>
                  {round.playedOn} · {t("course.holes", { count: round.holes })}
                  {round.score != null ? ` · ${round.score}` : ""}
                </li>
              ))}
            </ul>
          </section>
          <form className="stack card" action={addRound}>
            <h2>{t("course.addRound")}</h2>
            <p className="help">{t("course.secondRound")}</p>
            <input type="hidden" name="facilityId" value={facility.facilityId} />
            <label>
              {t("course.date")}
              <input type="date" name="playedOn" required defaultValue={halifaxToday()} max={halifaxToday()} />
            </label>
            <label>
              {t("directory.holes")}
              <select name="holes" defaultValue={facility.holeCount >= 18 ? "18" : "9"}>
                <option value="18">18</option>
                <option value="9">9</option>
              </select>
            </label>
            <label>
              {t("course.score")} <span className="muted">{t("course.scoreOptional")}</span>
              <input name="score" inputMode="numeric" />
            </label>
            <button type="submit">{t("course.addRound")}</button>
          </form>
        </div>
      ) : (
        <p>
          <a className="button" href={`/sign-up?returnTo=${encodeURIComponent(`/courses/${facility.facilityId}`)}`}>
            {t("home.markOn")}
          </a>
        </p>
      )}
    </article>
  );
}
