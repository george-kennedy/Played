"use client";

import dynamic from "next/dynamic";
import { Component, createContext, useContext, type ReactNode } from "react";
import type { PinCourse, PinMapLabels } from "./pin-course";

const LabelsContext = createContext<PinMapLabels | null>(null);

function MapLoading() {
  const labels = useContext(LabelsContext);
  return (
    <p className="pin-map-fallback" role="status">
      {labels?.loading}
    </p>
  );
}

const CoursePinMapView = dynamic(() => import("./course-pin-map-view"), {
  ssr: false,
  loading: MapLoading,
});

class MapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function CoursePinMap({
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
  return (
    <LabelsContext.Provider value={labels}>
      <MapBoundary
        fallback={
          <p className="pin-map-fallback" role="status">
            {labels.failed}
          </p>
        }
      >
        <CoursePinMapView courses={courses} labels={labels} today={today} returnTo={returnTo} />
      </MapBoundary>
    </LabelsContext.Provider>
  );
}
