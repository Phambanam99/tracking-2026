import { useEffect, useMemo, useRef } from "react";
import { boundingExtent } from "ol/extent";
import { fromLonLat } from "ol/proj";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useMapViewport } from "../../map/hooks/useMapViewport";
import { useShipSocket, type ShipSocketHandlers } from "../../map/hooks/useShipSocket";
import { useMapContext } from "../../map/context/MapContext";
import type { BoundingBox } from "../../map/render/flightLayer";
import { getShipHistory, searchShipGlobal } from "../api/shipSearchApi";
import { useShipViewportSnapshot } from "../hooks/useShipViewportSnapshot";
import { useShipLayerStore } from "../store/useShipLayerStore";
import { toShipTrailRouteKey, useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";
import { toLiveShip, toShip } from "../types/shipTypes";
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
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const VIEWPORT_PRUNE_GRACE_MS = 15_000;
const HISTORY_PREVIEW_FORWARD_MS = 5 * 60 * 1000;
const HISTORY_PREVIEW_LIMIT = 240;
const TRACKED_HYDRATE_RETRY_MS = 60_000;
const TRAIL_FIT_PADDING = [56, 56, 56, 320] as const;
const TRAIL_FIT_DURATION_MS = 400;
const TRAIL_FIT_MAX_ZOOM = 11;

export function ShipFeatureLayer(): JSX.Element {
  const { map } = useMapContext();
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
  const trailPoints = useShipStore((state) => state.trailPoints);
  const setTrailLoading = useShipStore((state) => state.setTrailLoading);
  const setTrailReady = useShipStore((state) => state.setTrailReady);
  const setTrailError = useShipStore((state) => state.setTrailError);
  const setActiveTrailRoute = useShipStore((state) => state.setActiveTrailRoute);
  const trailRoutes = useShipStore((state) => state.trailRoutes);
  const followSelected = useShipLayerStore((state) => state.followSelected);
  const trackedOnly = useShipLayerStore((state) => state.trackedOnly);
  const trackedGroupFilterIds = useShipLayerStore((state) => state.trackedGroupFilterIds);
  const trackedMmsis = useTrackedShipStore((state) => state.trackedMmsis);
  const trackedGroups = useTrackedShipStore((state) => state.groups);
  const viewportChangedAtRef = useRef(Date.now());
  const fittedTrailKeyRef = useRef<string | null>(null);
  const followedPositionKeyRef = useRef<string | null>(null);
  const hydrateAttemptAtRef = useRef<Record<string, number>>({});
  const hydratingMmsisRef = useRef(new Set<string>());

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
  useShipViewportSnapshot(token, viewport);

  useEffect(() => {
    viewportChangedAtRef.current = Date.now();
  }, [viewport.east, viewport.north, viewport.south, viewport.west]);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - viewportChangedAtRef.current < VIEWPORT_PRUNE_GRACE_MS) {
        return;
      }
      pruneStale(MAX_AGE_MS, new Set(Object.keys(trackedMmsis)));
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pruneStale, trackedMmsis]);

  useEffect(() => {
    const now = Date.now();
    const selectedGroups = trackedGroupFilterIds.length === 0
      ? trackedGroups
      : trackedGroups.filter((group) => trackedGroupFilterIds.includes(group.id));
    const groupsToHydrate = trackedOnly ? selectedGroups : trackedGroups;
    const targetMmsis = new Set(
      groupsToHydrate
        .filter((group) => trackedOnly || group.visibleOnMap)
        .flatMap((group) => group.mmsis),
    );

    const missingMmsis = Array.from(targetMmsis).filter((mmsi) => {
      if (ships[mmsi]) {
        return false;
      }
      if (hydratingMmsisRef.current.has(mmsi)) {
        return false;
      }
      const lastAttemptAt = hydrateAttemptAtRef.current[mmsi] ?? 0;
      return now - lastAttemptAt >= TRACKED_HYDRATE_RETRY_MS;
    });

    if (missingMmsis.length === 0) {
      return;
    }

    let cancelled = false;
    missingMmsis.forEach((mmsi) => {
      hydratingMmsisRef.current.add(mmsi);
      hydrateAttemptAtRef.current[mmsi] = Date.now();
      searchShipGlobal(mmsi)
        .then((response) => {
          const liveHit = response.results.find((result) => result.mmsi === mmsi);
          if (!liveHit) {
            return null;
          }

          upsertRef.current(toLiveShip(liveHit, Date.now()));
          return "hydrated-from-global" as const;
        })
        .then((result) => {
          if (result) {
            return null;
          }

          return getShipHistory(mmsi, {
            from: 0,
            to: Date.now(),
            limit: 1,
          });
        })
        .then((points) => {
          if (cancelled) {
            return;
          }
          if (!points) {
            return;
          }
          const point = points
            .slice()
            .sort((left, right) => right.eventTime - left.eventTime)[0];
          if (!point) {
            return;
          }
          upsertRef.current({
            mmsi,
            lat: point.lat,
            lon: point.lon,
            speed: point.speed ?? null,
            course: point.course ?? null,
            heading: point.heading ?? null,
            navStatus: point.navStatus ?? null,
            vesselName: null,
            vesselType: null,
            imo: null,
            callSign: null,
            destination: null,
            eta: null,
            eventTime: point.eventTime,
            sourceId: point.sourceId,
            isHistorical: true,
            metadata: null,
            lastSeen: Date.now(),
          });
        })
        .finally(() => {
          hydratingMmsisRef.current.delete(mmsi);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [ships, trackedGroupFilterIds, trackedGroups, trackedOnly]);

  useEffect(() => {
    const activeMmsi = detailMmsi ?? selectedMmsi;
    const activeMode = detailMmsi ? detailMode : selectedMode;
    const activeShip = activeMmsi ? ships[activeMmsi] : null;

    if (!activeMmsi || !activeShip) {
      return;
    }

    const routeKey = toShipTrailRouteKey(activeMmsi, activeShip.eventTime);
    const existingRoute = trailRoutes[routeKey];
    if (existingRoute && (existingRoute.status === "loading" || existingRoute.status === "ready" || existingRoute.status === "error")) {
      setActiveTrailRoute(routeKey);
      return;
    }

    const rangeTo = activeShip.eventTime + HISTORY_PREVIEW_FORWARD_MS;
    const rangeFrom = Math.max(0, activeShip.eventTime - trailWindowMs);
    let cancelled = false;

    setTrailLoading(routeKey, activeMmsi, activeShip.eventTime, rangeFrom, rangeTo);
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
          routeKey,
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
          routeKey,
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
    detailMmsi,
    detailMode,
    selectedMmsi,
    selectedMode,
    setActiveTrailRoute,
    setTrailError,
    setTrailLoading,
    setTrailReady,
    ships,
    trailRoutes,
    trailWindowMs,
  ]);

  useEffect(() => {
    const activeMmsi = detailMmsi ?? selectedMmsi;
    const activeMode = detailMmsi ? detailMode : selectedMode;

    if (
      !map
      || !activeMmsi
      || trailMmsi !== activeMmsi
      || (activeMode !== "history" && activeMode !== "global")
      || trailStatus !== "ready"
      || trailPoints.length < 2
    ) {
      return;
    }

    const trailKey = `${trailMmsi}:${trailAnchorTime}:${trailWindowMs}:${trailPoints.length}:${trailPoints[0]?.eventTime ?? ""}:${trailPoints[trailPoints.length - 1]?.eventTime ?? ""}`;
    if (fittedTrailKeyRef.current === trailKey) {
      return;
    }

    const extent = boundingExtent(trailPoints.map((point) => fromLonLat([point.lon, point.lat])));
    map.getView().fit(extent, {
      padding: [...TRAIL_FIT_PADDING],
      duration: TRAIL_FIT_DURATION_MS,
      maxZoom: TRAIL_FIT_MAX_ZOOM,
    });
    fittedTrailKeyRef.current = trailKey;
  }, [
    detailMmsi,
    detailMode,
    followSelected,
    map,
    selectedMmsi,
    selectedMode,
    trailAnchorTime,
    trailMmsi,
    trailPoints,
    trailStatus,
    trailWindowMs,
  ]);

  useEffect(() => {
    if (!map || !followSelected) {
      followedPositionKeyRef.current = null;
      return;
    }

    const activeMmsi = detailMmsi ?? selectedMmsi;
    if (!activeMmsi) {
      followedPositionKeyRef.current = null;
      return;
    }

    const ship = ships[activeMmsi];
    if (!ship) {
      return;
    }

    const positionKey = `${activeMmsi}:${ship.eventTime}:${ship.lat}:${ship.lon}`;
    if (followedPositionKeyRef.current === positionKey) {
      return;
    }

    map.getView().animate({
      center: fromLonLat([ship.lon, ship.lat]),
      duration: 320,
    });
    followedPositionKeyRef.current = positionKey;
  }, [detailMmsi, followSelected, map, selectedMmsi, ships]);

  return (
    <>
      <ShipMapLayer />
      <ShipPopup />
      <ShipDetailPanel />
    </>
  );
}
