import { useEffect, useRef } from "react";
import type { BoundingBox } from "../../map/render/flightLayer";
import { fetchLiveAircraftInViewport } from "../api/liveAircraftApi";
import { useAircraftStore } from "../store/useAircraftStore";

const VIEWPORT_SNAPSHOT_DEBOUNCE_MS = 350;

export function useViewportSnapshot(
  token: string | null,
  viewport: BoundingBox,
): void {
  const upsertAircraftBatch = useAircraftStore((state) => state.upsertAircraftBatch);
  const requestIdRef = useRef(0);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!token) {
      firstLoadRef.current = true;
      return;
    }

    const requestId = ++requestIdRef.current;
    const delay = firstLoadRef.current ? 0 : VIEWPORT_SNAPSHOT_DEBOUNCE_MS;

    const timeoutId = window.setTimeout(() => {
      void fetchLiveAircraftInViewport(viewport)
        .then((aircraft) => {
          if (requestId !== requestIdRef.current || aircraft.length === 0) {
            return;
          }
          upsertAircraftBatch(aircraft);
        })
        .catch((error) => {
          console.warn("[ViewportSnapshot]", error);
        });
    }, delay);

    firstLoadRef.current = false;

    return () => window.clearTimeout(timeoutId);
  }, [
    token,
    upsertAircraftBatch,
    viewport.east,
    viewport.north,
    viewport.south,
    viewport.west,
  ]);
}
