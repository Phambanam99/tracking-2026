import { useEffect, useMemo } from "react";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useLayerStore } from "../../map/store/useLayerStore";
import { useMapViewport } from "../../map/hooks/useMapViewport";
import type { BoundingBox } from "../../map/render/flightLayer";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";
import { usePlaybackStore } from "../../playback/store/usePlaybackStore";
import { PlaybackMapLayer } from "../../playback/components/PlaybackMapLayer";
import { useAircraftSocket } from "../hooks/useAircraftSocket";
import { useAircraftStore } from "../store/useAircraftStore";
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
 * - Renders `AircraftMapLayer` overlays and `AircraftPopup`.
 * - Restricts network/store loading to watchlist ICAOs only when military overlay is off.
 */
export function AircraftFeatureLayer(): JSX.Element {
  const token = useAuthStore((state) => state.accessToken);
  const layerVisibility = useLayerStore((state) => state.visible);
  const aircraftFilter = useLayerStore((state) => state.aircraftFilter);
  const playbackBarVisible = usePlaybackStore((state) => state.isBarVisible);
  const playbackStatus = usePlaybackStore((state) => state.status);
  const rawViewport = useMapViewport();
  const viewport: BoundingBox = rawViewport ?? DEFAULT_VIEWPORT;
  const watchlistGroups = useWatchlistStore((state) => state.groups);
  const retainOnly = useAircraftStore((state) => state.retainOnly);

  // Compute the set of watchlist ICAOs (stable across renders unless groups change).
  const watchlistIcaos = useMemo(() => {
    const icaos = new Set<string>();
    for (const group of watchlistGroups) {
      if (group.visibleOnMap && group.entries) {
        for (const entry of group.entries) {
          icaos.add(entry.icao.toLowerCase());
        }
      }
    }
    return icaos;
  }, [watchlistGroups]);

  const isMilitaryOnlyMode = layerVisibility.military;
  const isPlaybackReady = playbackBarVisible && playbackStatus === "ready";
  const liveDataEnabled = !(playbackBarVisible && playbackStatus === "ready");
  // Keep the phase-2 optimization for watchlist mode unless military-only mode is active.
  const shouldRestrictToWatchlist = aircraftFilter === "watchlist" && !isMilitaryOnlyMode;
  const icaoFilter = shouldRestrictToWatchlist ? watchlistIcaos : null;
  const aircraftPredicate = isMilitaryOnlyMode ? (aircraft: { isMilitary: boolean }) => aircraft.isMilitary : null;

  useViewportSnapshot(token, viewport, icaoFilter, aircraftPredicate, liveDataEnabled);
  useAircraftSocket(token, viewport, icaoFilter, aircraftPredicate, liveDataEnabled);

  // Prune store to match the active data restriction mode.
  useEffect(() => {
    if (isMilitaryOnlyMode) {
      const militaryIcaos = new Set<string>();
      for (const aircraft of Object.values(useAircraftStore.getState().aircraft)) {
        if (aircraft.isMilitary) {
          militaryIcaos.add(aircraft.icao.toLowerCase());
        }
      }
      retainOnly(militaryIcaos);
      return;
    }

    if (shouldRestrictToWatchlist) {
      retainOnly(watchlistIcaos);
    }
  }, [isMilitaryOnlyMode, shouldRestrictToWatchlist, watchlistIcaos, retainOnly]);

  return (
    <>
      <HistoryTrailLayer visible={layerVisibility.trail} />
      <AircraftMapLayer
        filter={aircraftFilter}
        visible={layerVisibility.live && !isMilitaryOnlyMode && !isPlaybackReady}
      />
      <AircraftMapLayer
        filter="watchlist"
        interactive={false}
        variant="watchlist"
        visible={layerVisibility.watchlist && !isMilitaryOnlyMode && !isPlaybackReady}
      />
      <AircraftMapLayer
        filter="military"
        interactive={true}
        variant="military"
        visible={isMilitaryOnlyMode && !isPlaybackReady}
      />
      <PlaybackMapLayer />
      <AircraftPopup />
      <AircraftDetailPanel />
    </>
  );
}
