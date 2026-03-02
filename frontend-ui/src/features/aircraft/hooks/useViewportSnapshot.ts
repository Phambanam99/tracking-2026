import { useEffect, useRef } from "react";
import type { BoundingBox } from "../../map/render/flightLayer";
import { fetchLiveAircraftInViewport } from "../api/liveAircraftApi";
import type { Aircraft } from "../types/aircraftTypes";
import { useAircraftStore } from "../store/useAircraftStore";

const VIEWPORT_SNAPSHOT_DEBOUNCE_MS = 350;

/**
 * Fetches a snapshot of live aircraft in the current viewport.
 *
 * When {@link icaoFilter} is provided (non-null), only aircraft whose ICAO
 * matches the filter set are upserted — the rest are discarded before touching
 * the store.  This avoids bloating the store when the user only cares about a
 * small subset (e.g. watchlist-only mode).
 */
export function useViewportSnapshot(
  token: string | null,
  viewport: BoundingBox,
  icaoFilter?: Set<string> | null,
  aircraftFilter?: ((aircraft: Aircraft) => boolean) | null,
): void {
  const upsertAircraftBatch = useAircraftStore((state) => state.upsertAircraftBatch);
  const requestIdRef = useRef(0);
  const firstLoadRef = useRef(true);
  const aircraftFilterRef = useRef(aircraftFilter ?? null);

  useEffect(() => {
    aircraftFilterRef.current = aircraftFilter ?? null;
  }, [aircraftFilter]);

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
          const activeAircraftFilter = aircraftFilterRef.current;
          const filtered = aircraft.filter((entry) => {
            if (icaoFilter && !icaoFilter.has(entry.icao.toLowerCase())) {
              return false;
            }
            if (activeAircraftFilter && !activeAircraftFilter(entry)) {
              return false;
            }
            return true;
          });
          if (filtered.length > 0) {
            upsertAircraftBatch(filtered);
          }
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
    icaoFilter,
    aircraftFilter,
  ]);
}
