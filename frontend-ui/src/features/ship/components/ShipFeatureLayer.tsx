import { useEffect, useMemo, useRef } from "react";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useMapViewport } from "../../map/hooks/useMapViewport";
import { useShipSocket, type ShipSocketHandlers } from "../../map/hooks/useShipSocket";
import type { BoundingBox } from "../../map/render/flightLayer";
import { getShipHistory } from "../api/shipSearchApi";
import { useShipStore } from "../store/useShipStore";
import { toShip } from "../types/shipTypes";
import { ShipDetailPanel } from "./ShipDetailPanel";
import { ShipMapLayer } from "./ShipMapLayer";
import { ShipPopup } from "./ShipPopup";

const DEFAULT_VIEWPORT: BoundingBox = {
  north: 30.0,
  south: 0.0,
  east: 125.0,
  west: 90.0,
};

const PRUNE_INTERVAL_MS = 30_000;
const MAX_AGE_MS = 300_000;
const VIEWPORT_PRUNE_GRACE_MS = 15_000;
const HISTORY_PREVIEW_FORWARD_MS = 5 * 60 * 1000;
const HISTORY_PREVIEW_LIMIT = 240;

export function ShipFeatureLayer(): JSX.Element {
  const token = useAuthStore((state) => state.accessToken);
  const rawViewport = useMapViewport();
  const viewport: BoundingBox = rawViewport ?? DEFAULT_VIEWPORT;
  const upsertShip = useShipStore((state) => state.upsertShip);
  const pruneStale = useShipStore((state) => state.pruneStale);
  const ships = useShipStore((state) => state.ships);
  const selectedMmsi = useShipStore((state) => state.selectedMmsi);
  const detailMmsi = useShipStore((state) => state.detailMmsi);
  const selectedMode = useShipStore((state) => state.selectedMode);
  const detailMode = useShipStore((state) => state.detailMode);
  const trailMmsi = useShipStore((state) => state.trailMmsi);
  const trailAnchorTime = useShipStore((state) => state.trailAnchorTime);
  const trailStatus = useShipStore((state) => state.trailStatus);
  const trailWindowMs = useShipStore((state) => state.trailWindowMs);
  const setTrailLoading = useShipStore((state) => state.setTrailLoading);
  const setTrailReady = useShipStore((state) => state.setTrailReady);
  const setTrailError = useShipStore((state) => state.setTrailError);
  const clearTrail = useShipStore((state) => state.clearTrail);
  const viewportChangedAtRef = useRef(Date.now());

  const upsertRef = useRef(upsertShip);
  useEffect(() => {
    upsertRef.current = upsertShip;
  }, [upsertShip]);

  const stableHandlers = useMemo<ShipSocketHandlers>(
    () => ({
      onMessage: (message) => {
        const ship = toShip(message.ship);
        if (ship.isHistorical) {
          return;
        }
        upsertRef.current(ship);
      },
      onError: (error) => console.warn("[ShipSocket]", error),
    }),
    [],
  );

  useShipSocket(token, viewport, stableHandlers);

  useEffect(() => {
    viewportChangedAtRef.current = Date.now();
  }, [viewport.east, viewport.north, viewport.south, viewport.west]);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - viewportChangedAtRef.current < VIEWPORT_PRUNE_GRACE_MS) {
        return;
      }
      pruneStale(MAX_AGE_MS);
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pruneStale]);

  useEffect(() => {
    const activeMmsi = detailMmsi ?? selectedMmsi;
    const activeMode = detailMmsi ? detailMode : selectedMode;
    const activeShip = activeMmsi ? ships[activeMmsi] : null;

    if (!activeMmsi || !activeShip || (activeMode !== "history" && activeMode !== "global")) {
      if (trailStatus !== "idle" || trailMmsi !== null) {
        clearTrail();
      }
      return;
    }

    if (
      trailMmsi === activeMmsi
      && trailAnchorTime === activeShip.eventTime
      && (trailStatus === "loading" || trailStatus === "ready" || trailStatus === "error")
    ) {
      return;
    }

    const rangeTo = activeShip.eventTime + HISTORY_PREVIEW_FORWARD_MS;
    const rangeFrom = Math.max(0, activeShip.eventTime - trailWindowMs);
    let cancelled = false;

    setTrailLoading(activeMmsi, activeShip.eventTime, rangeFrom, rangeTo);
    getShipHistory(activeMmsi, {
      from: rangeFrom,
      to: rangeTo,
      limit: HISTORY_PREVIEW_LIMIT,
    })
      .then((points) => {
        if (cancelled) {
          return;
        }
        setTrailReady(
          activeMmsi,
          activeShip.eventTime,
          points
            .slice()
            .sort((left, right) => left.eventTime - right.eventTime)
            .map((point) => ({
              lat: point.lat,
              lon: point.lon,
              eventTime: point.eventTime,
              speed: point.speed ?? null,
              course: point.course ?? null,
              heading: point.heading ?? null,
              sourceId: point.sourceId,
            })),
          rangeFrom,
          rangeTo,
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setTrailError(
          activeMmsi,
          activeShip.eventTime,
          error instanceof Error ? error.message : "history-preview-failed",
          rangeFrom,
          rangeTo,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    clearTrail,
    detailMmsi,
    detailMode,
    selectedMmsi,
    selectedMode,
    setTrailError,
    setTrailLoading,
    setTrailReady,
    ships,
    trailAnchorTime,
    trailMmsi,
    trailStatus,
    trailWindowMs,
  ]);

  return (
    <>
      <ShipMapLayer />
      <ShipPopup />
      <ShipDetailPanel />
    </>
  );
}
