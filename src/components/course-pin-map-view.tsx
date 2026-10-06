"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { createLayerComponent } from "@react-leaflet/core";
import L from "leaflet";
import type { ReactElement, ReactNode } from "react";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { addRound, setPlayed } from "@/app/actions";
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
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
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

function PinPopup({
  course,
  labels,
  today,
  returnTo,
}: {
  course: PinCourse;
  labels: PinMapLabels;
  today: string;
  returnTo: string;
}) {
  return (
    <div className="pin-popup" onPointerDown={keepPopupOpen} onClick={keepPopupOpen} onDoubleClick={keepPopupOpen}>
      <strong className="pin-title">{course.name}</strong>
      <p className="meta">{course.placeLine}</p>
      {course.personal === false ? null : <p>{course.played ? labels.played : labels.notPlayed}</p>}
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
      <Popup className="pin-popup-root" minWidth={240} maxWidth={320} maxHeight={280} autoPan>
        <PinPopup course={course} labels={labels} today={today} returnTo={returnTo} />
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
    </div>
  );
}
