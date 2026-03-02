import { useEffect, useMemo, useRef } from "react";
import {
  useFlightSocket,
  type FlightSocketHandlers,
} from "../../map/hooks/useFlightSocket";
import type { BoundingBox } from "../../map/render/flightLayer";
import { useAircraftStore } from "../store/useAircraftStore";
import { toAircraft, type Aircraft, type AircraftFlight } from "../types/aircraftTypes";

const PRUNE_INTERVAL_MS = 30_000;
const MAX_AGE_MS = 300_000;
const VIEWPORT_PRUNE_GRACE_MS = 15_000;

/**
 * Connects to the STOMP WebSocket, receives enriched flight messages, and
 * upserts them into the aircraft Zustand store. Also prunes stale aircraft
 * on a regular interval.
 *
 * When {@link icaoFilter} is provided (non-null), only aircraft whose ICAO is
 * in the set are upserted into the store — the rest are silently discarded.
 * This reduces store writes and React re-renders when the user only cares
 * about a subset (e.g. watchlist-only mode).
 */
export function useAircraftSocket(
  token: string | null,
  viewport: BoundingBox,
  icaoFilter?: Set<string> | null,
  aircraftFilter?: ((aircraft: Aircraft) => boolean) | null,
): void {
  const upsertAircraft = useAircraftStore((s) => s.upsertAircraft);
  const pruneStale = useAircraftStore((s) => s.pruneStale);
  const viewportChangedAtRef = useRef(Date.now());

  // Stable ref so that the handlers object identity never changes,
  // preventing unnecessary socket reconnections.
  const upsertRef = useRef(upsertAircraft);
  useEffect(() => {
    upsertRef.current = upsertAircraft;
  }, [upsertAircraft]);

  // Keep a mutable ref so the stable handler closure always reads the latest filter.
  const icaoFilterRef = useRef(icaoFilter ?? null);
  useEffect(() => {
    icaoFilterRef.current = icaoFilter ?? null;
  }, [icaoFilter]);

  const aircraftFilterRef = useRef(aircraftFilter ?? null);
  useEffect(() => {
    aircraftFilterRef.current = aircraftFilter ?? null;
  }, [aircraftFilter]);

  const stableHandlers = useMemo<FlightSocketHandlers>(
    () => ({
      onMessage: (msg) => {
        // The backend enriches the flight payload with AircraftMetadata fields.
        const flight = msg.flight as AircraftFlight;
        const activeFilter = icaoFilterRef.current;
        if (activeFilter && !activeFilter.has(flight.icao?.toLowerCase?.())) {
          return; // Skip: aircraft not in the active ICAO filter.
        }
        const aircraft = toAircraft(flight);
        const activeAircraftFilter = aircraftFilterRef.current;
        if (activeAircraftFilter && !activeAircraftFilter(aircraft)) {
          return;
        }
        upsertRef.current(aircraft);
      },
      onError: (err) => console.warn("[AircraftSocket]", err),
    }),
    [],
  );

  useFlightSocket(token, viewport, stableHandlers);

  useEffect(() => {
    viewportChangedAtRef.current = Date.now();
  }, [viewport.east, viewport.north, viewport.south, viewport.west]);

  // Prune stale aircraft periodically.
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - viewportChangedAtRef.current < VIEWPORT_PRUNE_GRACE_MS) {
        return;
      }
      pruneStale(MAX_AGE_MS);
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pruneStale]);
}
