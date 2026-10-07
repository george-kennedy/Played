"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { createLayerComponent } from "@react-leaflet/core";
import L from "leaflet";
import type { ReactElement, ReactNode } from "react";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { addRound, setPlayed } from "@/app/actions";
import type { CourseMedia } from "@/lib/course-media";
import type { PinCourse, PinMapLabels } from "./pin-course";
import { openMarkerHtml, playedMarkerHtml } from "./pin-glyphs";
import "leaflet/dist/leaflet.css";

const playedIcon = L.divIcon({
  className: "pin-marker",
  html: playedMarkerHtml(),
  iconSize: [32, 42],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
});

const openIcon = L.divIcon({
  className: "pin-marker",
  html: openMarkerHtml(),
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

const MarkerClusterGroup = createLayerComponent<L.MarkerClusterGroup, L.MarkerClusterGroupOptions>(
  function createCluster(props, context) {
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius(zoom) {
        if (zoom <= 4) return 200;
        if (zoom === 5) return 120;
        return 70;
      },
      disableClusteringAtZoom: 7,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      iconCreateFunction(group) {
        const count = group.getChildCount();
        return L.divIcon({
          html: `<span class="pin-cluster-count">${count}</span>`,
          className: "pin-cluster",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
      },
      ...props,
    });
    return { instance: cluster, context: { ...context, layerContainer: cluster } };
  },
  function updateCluster() {},
) as (props: { children?: ReactNode }) => ReactElement;

function FitPins({ courses }: { courses: PinCourse[] }) {
  const map = useMap();
  const fitKey = courses.map((course) => `${course.facilityId}:${course.latitude}:${course.longitude}`).join("|");
  useEffect(() => {
    if (courses.length === 0) return;
    map.invalidateSize();
    map.fitBounds(
      courses.map((course) => [course.latitude, course.longitude] as L.LatLngTuple),
      { padding: [28, 28], maxZoom: 9 },
    );
  }, [map, fitKey, courses]);
  return null;
}

function keepPopupOpen(event: { stopPropagation: () => void; nativeEvent: { stopPropagation: () => void } }) {
  event.stopPropagation();
  event.nativeEvent.stopPropagation();
}

function WindowExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="2.25" y="2.25" width="11.5" height="11.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PinPopup({
  course,
  labels,
  today,
  returnTo,
  onExpand,
}: {
  course: PinCourse;
  labels: PinMapLabels;
  today: string;
  returnTo: string;
  onExpand: (course: PinCourse) => void;
}) {
  const map = useMap();
  return (
    <div className="pin-popup" onPointerDown={keepPopupOpen} onClick={keepPopupOpen} onDoubleClick={keepPopupOpen}>
      <div className="pin-popup-bar">
        <strong className="pin-title">{course.name}</strong>
        <button
          type="button"
          className="window-control"
          aria-label={labels.expand}
          onClick={() => {
            onExpand(course);
            map.closePopup();
          }}
        >
          <WindowExpandIcon />
        </button>
      </div>
      <p className="meta">{course.placeLine}</p>
      {course.personal === false ? null : <p>{course.played ? labels.played : labels.notPlayed}</p>}
      {course.standing ? <p>{course.standing}</p> : null}
      {course.suited ? <p>{course.suited}</p> : null}
      {course.personal !== false && course.played ? (
        <div>
          <p className="pin-label">{labels.rounds}</p>
          {course.rounds.length === 0 ? <p>{labels.noRounds}</p> : null}
          <ul className="rounds">
            {course.rounds.map((round) => (
              <li key={round.id}>
                {round.playedOn} · {round.holesLabel}
                {round.score != null ? ` · ${round.score}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {course.personal === false ? (
        <p>
          <a href="/sign-in">{labels.signIn}</a>
        </p>
      ) : null}
      {course.personal !== false && course.played && course.markRoundId ? (
        <form action={setPlayed}>
          <input type="hidden" name="facilityId" value={course.facilityId} />
          <input type="hidden" name="intent" value="off" />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="secondary" type="submit">
            {labels.markOff}
          </button>
        </form>
      ) : null}
      {course.personal !== false && course.played && !course.markRoundId ? (
        <span className="pill">{labels.playedKeep}</span>
      ) : null}
      {course.personal !== false && !course.played ? (
        <form action={setPlayed}>
          <input type="hidden" name="facilityId" value={course.facilityId} />
          <input type="hidden" name="intent" value="on" />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit">{labels.markOn}</button>
        </form>
      ) : null}
      {course.personal === false ? null : (
      <form className="pin-round" action={addRound}>
        <p className="pin-label">{labels.addRound}</p>
        <p className="help">{labels.secondRound}</p>
        <input type="hidden" name="facilityId" value={course.facilityId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label>
          {labels.date}
          <input type="date" name="playedOn" required defaultValue={today} max={today} />
        </label>
        <label>
          {labels.holes}
          <select name="holes" defaultValue={course.defaultHoles}>
            <option value="18">18</option>
            <option value="9">9</option>
          </select>
        </label>
        <label>
          {labels.score} <span className="muted">{labels.scoreOptional}</span>
          <input name="score" inputMode="numeric" />
        </label>
        <button type="submit">{labels.addRound}</button>
      </form>
      )}
      <p>
        <a href={`/courses/${course.facilityId}`}>{labels.courseLink}</a>
      </p>
    </div>
  );
}

function CourseWindow({
  course,
  labels,
  today,
  returnTo,
  onClose,
}: {
  course: PinCourse;
  labels: PinMapLabels;
  today: string;
  returnTo: string;
  onClose: () => void;
}) {
  const frame = useRef<HTMLElement>(null);
  const [media, setMedia] = useState<CourseMedia | null>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const width = 380;
    const height = Math.min(560, window.innerHeight - 48);
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${Math.max(16, (window.innerWidth - width) / 2)}px`;
    el.style.top = `${Math.max(16, (window.innerHeight - height) / 2)}px`;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/courses/${encodeURIComponent(course.facilityId)}/media`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<CourseMedia>) : null))
      .then((body) => {
        if (!controller.signal.aborted) setMedia(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMedia({ photoUrl: null, websiteUrl: null, bookingUrl: null, phone: null });
      });
    return () => controller.abort();
  }, [course.facilityId]);
  const lists = course.lists ?? [];
  const onResizePointerDown = (edge: string) => (event: ReactPointerEvent<HTMLElement>) => {
    const el = frame.current;
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = el.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let left = rect.left;
      let top = rect.top;
      let width = rect.width;
      let height = rect.height;
      if (edge.includes("e")) width = Math.max(280, rect.width + dx);
      if (edge.includes("s")) height = Math.max(240, rect.height + dy);
      if (edge.includes("w")) {
        width = Math.max(280, rect.width - dx);
        left = rect.right - width;
      }
      if (edge.includes("n")) {
        height = Math.max(240, rect.height - dy);
        top = rect.bottom - height;
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
  };
  const onTitlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const el = frame.current;
    if (!el) return;
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = el.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      el.style.left = `${rect.left + ev.clientX - startX}px`;
      el.style.top = `${rect.top + ev.clientY - startY}px`;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
  };
  return createPortal(
    <section className="course-window" ref={frame} role="dialog" aria-label={course.name}>
      <header className="course-window-bar" onPointerDown={onTitlePointerDown}>
        <strong>{course.name}</strong>
        <button type="button" className="window-control" aria-label={labels.close} onClick={onClose}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </header>
      <div className="course-window-body">
        {media?.photoUrl ? (
          <img className="pin-popup-photo" src={media.photoUrl} alt="" />
        ) : (
          <p className="help">{media ? labels.noPhoto : labels.photoLoading}</p>
        )}
        <p className="meta">{course.placeLine}</p>
        {course.ratingLine ? <p className="meta">{course.ratingLine}</p> : null}
        {course.personal === false ? null : <p>{course.played ? labels.played : labels.notPlayed}</p>}
        <p className="pin-label">{labels.rankings}</p>
        {lists.length === 0 ? <p className="help">{labels.noRanking}</p> : null}
        {lists.map((list) => (
          <p key={list}>{list === "national" ? labels.onNational : labels.onPublic}</p>
        ))}
        {media?.websiteUrl || media?.bookingUrl || media?.phone ? (
          <div className="course-actions">
            {media.bookingUrl ? (
              <a className="button" href={media.bookingUrl} rel="noreferrer">
                {labels.book}
              </a>
            ) : media.phone ? (
              <a className="button" href={`tel:+1${media.phone.replace(/\D/g, "")}`}>
                {labels.call.replace("{phone}", media.phone)}
              </a>
            ) : null}
            {media.websiteUrl ? (
              <a className="button secondary" href={media.websiteUrl} rel="noreferrer">
                {labels.website}
              </a>
            ) : null}
          </div>
        ) : null}
        <p className="pin-label">{labels.reviews}</p>
        <p className="help">{labels.noReviews}</p>
        {course.standing ? <p>{course.standing}</p> : null}
        {course.suited ? <p>{course.suited}</p> : null}
        {course.personal !== false && course.played ? (
          <div>
            <p className="pin-label">{labels.rounds}</p>
            {course.rounds.length === 0 ? <p>{labels.noRounds}</p> : null}
            <ul className="rounds">
              {course.rounds.map((round) => (
                <li key={round.id}>
                  {round.playedOn} · {round.holesLabel}
                  {round.score != null ? ` · ${round.score}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {course.personal === false ? (
          <p>
            <a href="/sign-in">{labels.signIn}</a>
          </p>
        ) : null}
        {course.personal !== false && course.played && course.markRoundId ? (
          <form action={setPlayed}>
            <input type="hidden" name="facilityId" value={course.facilityId} />
            <input type="hidden" name="intent" value="off" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="secondary" type="submit">
              {labels.markOff}
            </button>
          </form>
        ) : null}
        {course.personal !== false && course.played && !course.markRoundId ? (
          <span className="pill">{labels.playedKeep}</span>
        ) : null}
        {course.personal !== false && !course.played ? (
          <form action={setPlayed}>
            <input type="hidden" name="facilityId" value={course.facilityId} />
            <input type="hidden" name="intent" value="on" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit">{labels.markOn}</button>
          </form>
        ) : null}
        {course.personal === false ? null : (
          <form className="pin-round" action={addRound}>
            <p className="pin-label">{labels.addRound}</p>
            <p className="help">{labels.secondRound}</p>
            <input type="hidden" name="facilityId" value={course.facilityId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              {labels.date}
              <input type="date" name="playedOn" required defaultValue={today} max={today} />
            </label>
            <label>
              {labels.holes}
              <select name="holes" defaultValue={course.defaultHoles}>
                <option value="18">18</option>
                <option value="9">9</option>
              </select>
            </label>
            <label>
              {labels.score} <span className="muted">{labels.scoreOptional}</span>
              <input name="score" inputMode="numeric" />
            </label>
            <button type="submit">{labels.addRound}</button>
          </form>
        )}
        <p>
          <a href={`/courses/${course.facilityId}`}>{labels.courseLink}</a>
        </p>
      </div>
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((edge) => (
        <div key={edge} className={`course-window-edge ${edge}`} onPointerDown={onResizePointerDown(edge)} />
      ))}
    </section>,
    document.body,
  );
}

export default function CoursePinMapView({
  courses,
  labels,
  today,
  returnTo,
}: {
  courses: PinCourse[];
  labels: PinMapLabels;
  today: string;
  returnTo: string;
}) {
  const [windowCourse, setWindowCourse] = useState<PinCourse | null>(null);
  if (courses.length === 0) {
    return <p className="pin-map-fallback">{labels.empty}</p>;
  }
  const bounds = L.latLngBounds(courses.map((course) => [course.latitude, course.longitude] as L.LatLngTuple));
  const markers = courses.map((course) => (
    <Marker
      key={course.facilityId}
      position={[course.latitude, course.longitude]}
      icon={course.personal === false || course.played ? playedIcon : openIcon}
      title={
        course.personal === false
          ? course.name
          : `${course.name}. ${course.played ? labels.played : labels.notPlayed}`
      }
      alt={
        course.personal === false
          ? course.name
          : `${course.name}. ${course.played ? labels.played : labels.notPlayed}`
      }
      keyboard
      riseOnHover
      zIndexOffset={course.played ? 400 : 0}
    >
      <Popup className="pin-popup-root" minWidth={240} maxWidth={320} maxHeight={360} autoPan>
        <PinPopup
          course={course}
          labels={labels}
          today={today}
          returnTo={returnTo}
          onExpand={setWindowCourse}
        />
      </Popup>
    </Marker>
  ));
  return (
    <div className="pin-map" role="region" aria-label={labels.region}>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [28, 28], maxZoom: 9 }}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPins courses={courses} />
        {courses.length > 60 ? <MarkerClusterGroup>{markers}</MarkerClusterGroup> : markers}
      </MapContainer>
      {windowCourse ? (
        <CourseWindow
          course={windowCourse}
          labels={labels}
          today={today}
          returnTo={returnTo}
          onClose={() => setWindowCourse(null)}
        />
      ) : null}
    </div>
  );
}
