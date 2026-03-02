import { useEffect, useMemo, useRef } from "react";
import {
  useFlightSocket,
  type FlightSocketHandlers,
} from "../../map/hooks/useFlightSocket";
import type { BoundingBox } from "../../map/render/flightLayer";
import { useAircraftStore } from "../store/useAircraftStore";
import { toAircraft, type AircraftFlight } from "../types/aircraftTypes";

const PRUNE_INTERVAL_MS = 30_000;
const MAX_AGE_MS = 300_000;
const VIEWPORT_PRUNE_GRACE_MS = 15_000;

/**
 * Connects to the STOMP WebSocket, receives enriched flight messages, and
 * upserts them into the aircraft Zustand store. Also prunes stale aircraft
 * on a regular interval.
 */
export function useAircraftSocket(
  token: string | null,
  viewport: BoundingBox,
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

  const stableHandlers = useMemo<FlightSocketHandlers>(
    () => ({
      onMessage: (msg) => {
        // The backend enriches the flight payload with AircraftMetadata fields.
        const flight = msg.flight as AircraftFlight;
        upsertRef.current(toAircraft(flight));
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
