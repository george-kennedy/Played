import { setPlayed } from "@/app/actions";
import { provinceLabel } from "@/components/coverage-block";
import { distanceKm, placeById, PLACES } from "@/lib/distance";
import { translate } from "@/lib/i18n";
import { getDb, listFacilities, readStatuses } from "@/lib/db";
import { currentLocale, currentUser } from "@/lib/session";
import type { Facility, Province } from "@/lib/types";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const locale = await currentLocale();
  const user = await currentUser();
  const params = await searchParams;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const q = (params.q ?? "").trim().toLowerCase();
  const played = params.played ?? "";
  const access = params.access ?? "";
  const holes = params.holes ?? "";
  const sort = params.sort === "distance" ? "distance" : "name";
  const place = placeById(params.place) ?? (user?.place_id ? placeById(user.place_id) : null);
  const db = getDb();
  const statuses = user ? new Map(readStatuses(db, user.id).map((status) => [status.facilityId, status])) : new Map();
  let facilities = listFacilities(db);
  if (q) {
    facilities = facilities.filter((facility) =>
      `${facility.officialName} ${facility.place ?? ""}`.toLowerCase().includes(q),
    );
  }
  if (access === "public" || access === "private") {
    facilities = facilities.filter((facility) => facility.access === access);
  }
  if (holes === "18") facilities = facilities.filter((facility) => facility.holeCount >= 18);
  if (played === "played" || played === "unplayed") {
    facilities = facilities.filter((facility) => {
      const isPlayed = statuses.has(facility.facilityId);
      return played === "played" ? isPlayed : !isPlayed;
    });
  }

  const ranked = facilities.map((facility) => {
    const km =
      place && facility.latitude != null && facility.longitude != null
        ? distanceKm(place.latitude, place.longitude, facility.latitude, facility.longitude)
        : null;
    return { facility, km };
  });
  ranked.sort((a, b) => {
    if (sort === "distance") {
      if (a.km === null && b.km === null) return a.facility.officialName.localeCompare(b.facility.officialName);
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    }
    return a.facility.officialName.localeCompare(b.facility.officialName);
  });

  const query = new URLSearchParams();
  if (q) query.set("q", params.q ?? "");
  if (played) query.set("played", played);
  if (access) query.set("access", access);
  if (holes) query.set("holes", holes);
  if (sort === "distance") query.set("sort", "distance");
  if (place) query.set("place", place.id);

  return (
    <div className="stack">
      <h1>{t("directory.title")}</h1>
      <p className="help">{t("directory.noMap")}</p>
      <form className="filters card" method="get">
        <label>
          {t("directory.search")}
          <input name="q" defaultValue={params.q ?? ""} />
        </label>
        <label>
          {t("directory.played")}
          <select name="played" defaultValue={played}>
            <option value="">{t("directory.any")}</option>
            <option value="played">{t("home.played")}</option>
            <option value="unplayed">{t("home.notPlayed")}</option>
          </select>
        </label>
        <label>
          {t("directory.access")}
          <select name="access" defaultValue={access}>
            <option value="">{t("directory.any")}</option>
            <option value="public">{t("access.public")}</option>
            <option value="private">{t("access.private")}</option>
          </select>
        </label>
        <label>
          {t("directory.holes")}
          <select name="holes" defaultValue={holes}>
            <option value="">{t("directory.any")}</option>
            <option value="18">{t("directory.holes18")}</option>
          </select>
        </label>
        <label>
          {t("directory.sort")}
          <select name="sort" defaultValue={sort}>
            <option value="name">{t("directory.sortName")}</option>
            <option value="distance">{t("directory.sortDistance")}</option>
          </select>
        </label>
        {place ? <input type="hidden" name="place" value={place.id} /> : null}
        <button type="submit">{t("directory.apply")}</button>
      </form>
      {!user && (played === "played" || played === "unplayed") ? <p>{t("directory.signInForPlayed")}</p> : null}
      <div>
        <p className="muted">{t("directory.place")}</p>
        <div className="places">
          {PLACES.map((item) => {
            const next = new URLSearchParams(query);
            next.set("place", item.id);
            next.set("sort", "distance");
            return (
              <a key={item.id} className="button secondary" href={`/directory?${next.toString()}`} aria-current={place?.id === item.id ? "page" : undefined}>
                {t(`place.${item.id}`)}
              </a>
            );
          })}
        </div>
      </div>
      {ranked.length === 0 ? <p>{t("directory.empty")}</p> : null}
      <ul className="course-list">
        {ranked.map(({ facility, km }) => (
          <DirectoryRow
            key={facility.facilityId}
            facility={facility}
            km={km}
            distanceRequested={sort === "distance"}
            played={statuses.has(facility.facilityId)}
            markRoundId={statuses.get(facility.facilityId)?.markRoundId ?? null}
            signedIn={Boolean(user?.email_verified_at)}
            locale={locale}
            returnTo={`/directory?${query.toString()}`}
          />
        ))}
      </ul>
    </div>
  );
}

function DirectoryRow({
  facility,
  km,
  distanceRequested,
  played,
  markRoundId,
  signedIn,
  locale,
  returnTo,
}: {
  facility: Facility;
  km: number | null;
  distanceRequested: boolean;
  played: boolean;
  markRoundId: string | null;
  signedIn: boolean;
  locale: "en" | "fr";
  returnTo: string;
}) {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const access = facility.access === "public" ? t("access.public") : t("access.private");
  const distance = !distanceRequested
    ? null
    : km === null
      ? t("directory.distanceUnavailable")
      : t("directory.km", { km: km >= 10 ? Math.round(km) : km.toFixed(1) });
  return (
    <li className="course-row">
      <div>
        <a className="course-name" href={`/courses/${facility.facilityId}`}>{facility.officialName}</a>
        <p className="meta">
          {[facility.place, provinceLabel(locale, facility.province as Province)].filter(Boolean).join(", ")}
          {" · "}
          {access}
          {" · "}
          {t("course.holes", { count: facility.holeCount })}
          {distance ? ` · ${distance}` : ""}
          {signedIn ? ` · ${played ? t("home.played") : t("home.notPlayed")}` : ""}
        </p>
      </div>
      {signedIn && !played ? (
        <form action={setPlayed}>
          <input type="hidden" name="facilityId" value={facility.facilityId} />
          <input type="hidden" name="intent" value="on" />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit">{t("home.markOn")}</button>
        </form>
      ) : null}
      {signedIn && played && markRoundId ? (
        <form action={setPlayed}>
          <input type="hidden" name="facilityId" value={facility.facilityId} />
          <input type="hidden" name="intent" value="off" />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="secondary" type="submit">{t("home.markOff")}</button>
        </form>
      ) : null}
    </li>
  );
}
