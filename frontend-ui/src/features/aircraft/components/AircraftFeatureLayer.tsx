import { useAuthStore } from "../../auth/store/useAuthStore";
import { useMapViewport } from "../../map/hooks/useMapViewport";
import type { BoundingBox } from "../../map/render/flightLayer";
import { useAircraftSocket } from "../hooks/useAircraftSocket";
import { useViewportSnapshot } from "../hooks/useViewportSnapshot";
import { AircraftMapLayer } from "./AircraftMapLayer";
import { HistoryTrailLayer } from "./HistoryTrailLayer";
import { AircraftPopup } from "./AircraftPopup";
import { AircraftDetailPanel } from "./AircraftDetailPanel";

/** Default viewport centred on South-East Asia so the socket isn't empty on first load. */
const DEFAULT_VIEWPORT: BoundingBox = {
  north: 30.0,
  south: 0.0,
  east: 125.0,
  west: 90.0,
};

/**
 * Top-level aircraft feature orchestrator.
 *
 * Must be rendered as a child of {@link MapContainer} (inside MapContext.Provider)
 * because it calls `useMapViewport` which requires a live OL map context.
 *
 * Responsibilities:
 * - Reads the auth token from the auth store.
 * - Reads the current map viewport (live, updates on pan/zoom).
 * - Drives the STOMP WebSocket via `useAircraftSocket`.
 * - Renders `AircraftMapLayer` (OL vector layer, no DOM) and `AircraftPopup` (OL overlay).
 */
export function AircraftFeatureLayer(): JSX.Element {
  const token = useAuthStore((state) => state.accessToken);
  const rawViewport = useMapViewport();
  const viewport: BoundingBox = rawViewport ?? DEFAULT_VIEWPORT;

  useViewportSnapshot(token, viewport);
  useAircraftSocket(token, viewport);

  return (
    <>
      <HistoryTrailLayer />
      <AircraftMapLayer />
      <AircraftPopup />
      <AircraftDetailPanel />
    </>
  );
}
