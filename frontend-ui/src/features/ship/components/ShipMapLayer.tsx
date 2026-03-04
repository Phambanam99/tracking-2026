import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureLike } from "ol/Feature";
import type { MapBrowserEvent } from "ol";
import { Feature } from "ol";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import Icon from "ol/style/Icon";
import { Fill, Stroke, Style, Text } from "ol/style";
import { useMapContext } from "../../map/context/MapContext";
import { splitRouteSegments } from "../../map/render/splitRouteSegments";
import { resolveShipVisualStyle } from "../render/shipVisuals";
import { useShipLayerStore } from "../store/useShipLayerStore";
import { useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";
import type { Ship } from "../types/shipTypes";

type HoverState = {
  mmsi: string;
  pixel: [number, number];
};

const SHIP_LAYER_Z_INDEX = 10;
const SHIP_TRAIL_LAYER_Z_INDEX = 9;
const VESSEL_ICON_SRC = "/vessel-icon.svg";
const SHIP_ROUTE_MAX_GAP_MS = 45 * 60 * 1000;
const SHIP_ROUTE_MAX_SPEED_KTS = 80;

function resolveShipHeading(ship: Ship): number {
  return ship.heading ?? ship.course ?? 90;
}

function createShipStyle(ship: Ship, showLabels: boolean, isTracked: boolean): Style {
  const visual = resolveShipVisualStyle(ship, isTracked);

  return new Style({
    image: new Icon({
      src: VESSEL_ICON_SRC,
      color: visual.color,
      scale: ship.metadata?.isMilitary ? 1.18 : 1.08,
      rotateWithView: true,
      rotation: ((resolveShipHeading(ship) - 90) * Math.PI) / 180,
    }),
    text: showLabels ? new Text({
      text: ship.vesselName ?? ship.mmsi,
      offsetY: 18,
      font: "600 11px ui-sans-serif",
      fill: new Fill({ color: "#e2e8f0" }),
      backgroundFill: new Fill({ color: "rgba(2, 6, 23, 0.72)" }),
      padding: [2, 4, 2, 4],
    }) : undefined,
  });
}

function createSelectedShipStyle(ship: Ship, showLabels: boolean, isTracked: boolean): Style {
  const visual = resolveShipVisualStyle(ship, isTracked);
  return new Style({
    image: new Icon({
      src: VESSEL_ICON_SRC,
      color: visual.selectedColor,
      scale: ship.metadata?.isMilitary ? 1.34 : 1.22,
      rotateWithView: true,
      rotation: ((resolveShipHeading(ship) - 90) * Math.PI) / 180,
    }),
    text: showLabels ? new Text({
      text: ship.vesselName ?? ship.mmsi,
      offsetY: 18,
      font: "700 11px ui-sans-serif",
      fill: new Fill({ color: "#f8fafc" }),
      backgroundFill: new Fill({ color: "rgba(15, 23, 42, 0.88)" }),
      stroke: new Stroke({ color: "rgba(45, 212, 191, 0.55)", width: 2 }),
      padding: [2, 4, 2, 4],
    }) : undefined,
  });
}

function buildFeature(ship: Ship, isSelected: boolean, showLabels: boolean, isTracked: boolean): Feature<Point> {
  const feature = new Feature<Point>({
    geometry: new Point(fromLonLat([ship.lon, ship.lat])),
    mmsi: ship.mmsi,
  });
  feature.setId(ship.mmsi);
  feature.setStyle(
    isSelected
      ? createSelectedShipStyle(ship, showLabels, isTracked)
      : createShipStyle(ship, showLabels, isTracked),
  );
  return feature;
}

function syncFeatures(
  source: VectorSource,
  shipMap: Record<string, Ship>,
  selectedMmsi: string | null,
  showLabels: boolean,
  trackedMmsis: Record<string, true>,
): void {
  const nextMmsiSet = new Set(Object.keys(shipMap));

  source.getFeatures().forEach((feature) => {
    const id = feature.getId() as string;
    if (!nextMmsiSet.has(id)) {
      source.removeFeature(feature);
    }
  });

  for (const ship of Object.values(shipMap)) {
    const existing = source.getFeatureById(ship.mmsi) as Feature<Point> | null;
    const isSelected = ship.mmsi === selectedMmsi;
    const isTracked = Boolean(trackedMmsis[ship.mmsi]);
    if (existing) {
      existing.getGeometry()?.setCoordinates(fromLonLat([ship.lon, ship.lat]));
      existing.setStyle(
        isSelected
          ? createSelectedShipStyle(ship, showLabels, isTracked)
          : createShipStyle(ship, showLabels, isTracked),
      );
    } else {
      source.addFeature(buildFeature(ship, isSelected, showLabels, isTracked));
    }
  }
}

function pickShipsByMmsi(shipMap: Record<string, Ship>, allowedMmsis: Set<string>): Record<string, Ship> {
  return Object.fromEntries(Object.entries(shipMap).filter(([mmsi]) => allowedMmsis.has(mmsi)));
}

function createTrailStyle(color = "rgba(129, 140, 248, 0.85)", dashed = false): Style {
  return new Style({
    stroke: new Stroke({
      color,
      width: dashed ? 2 : 2.5,
      lineDash: dashed ? [5, 4] : undefined,
    }),
  });
}

function createTrailCurrentPointStyle(color: string): Style {
  return new Style({
    image: new Icon({
      src: VESSEL_ICON_SRC,
      color,
      scale: 0.95,
      rotateWithView: true,
    }),
  });
}

function syncTrailFeatures(
  source: VectorSource,
  trailRoutes: ReturnType<typeof useShipStore.getState>["trailRoutes"],
  trailRouteOrder: string[],
  activeTrailRouteKey: string | null,
): void {
  source.clear();

  for (const routeKey of trailRouteOrder) {
    const route = trailRoutes[routeKey];
    if (!route || route.points.length === 0) {
      continue;
    }

    const isActive = route.key === activeTrailRouteKey;
    const segments = splitRouteSegments(route.points, {
      maxGapMs: SHIP_ROUTE_MAX_GAP_MS,
      maxSpeedKts: SHIP_ROUTE_MAX_SPEED_KTS,
    });

    segments.forEach((segment, segmentIndex) => {
      if (segment.length < 2) {
        return;
      }

      const feature = new Feature<LineString>({
        geometry: new LineString(segment.map((point) => fromLonLat([point.lon, point.lat]))),
      });
      feature.setId(`ship-trail-${routeKey}-${segmentIndex}`);
      feature.set("routeKey", routeKey);
      feature.set("mmsi", route.mmsi);
      feature.setStyle(createTrailStyle(route.color, !isActive));
      source.addFeature(feature);
    });

    if (isActive) {
      const currentPoint = route.points[route.points.length - 1];
      if (currentPoint) {
        const currentPointFeature = new Feature<Point>({
          geometry: new Point(fromLonLat([currentPoint.lon, currentPoint.lat])),
        });
        currentPointFeature.setId(`ship-trail-${routeKey}-current`);
        currentPointFeature.set("routeKey", routeKey);
        currentPointFeature.set("mmsi", route.mmsi);
        currentPointFeature.setStyle(createTrailCurrentPointStyle(route.color));
        source.addFeature(currentPointFeature);
      }
    }
  }
}

export function ShipMapLayer(): JSX.Element | null {
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const trailLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const trailSourceRef = useRef<VectorSource | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const ships = useShipStore((state) => state.ships);
  const selectedMmsi = useShipStore((state) => state.selectedMmsi);
  const selectShip = useShipStore((state) => state.selectShip);
  const showDetails = useShipStore((state) => state.showDetails);
  const trailRoutes = useShipStore((state) => state.trailRoutes);
  const trailRouteOrder = useShipStore((state) => state.trailRouteOrder);
  const activeTrailRouteKey = useShipStore((state) => state.activeTrailRouteKey);
  const setActiveTrailRoute = useShipStore((state) => state.setActiveTrailRoute);
  const shipLayers = useShipLayerStore((state) => state.visible);
  const trackedOnly = useShipLayerStore((state) => state.trackedOnly);
  const trackedGroupFilterIds = useShipLayerStore((state) => state.trackedGroupFilterIds);
  const trackedMmsis = useTrackedShipStore((state) => state.trackedMmsis);
  const groups = useTrackedShipStore((state) => state.groups);
  const visibleTrackedMmsis = useMemo(() => {
    const next = new Set<string>();
    const activeGroups = trackedGroupFilterIds.length === 0
      ? groups
      : groups.filter((group) => trackedGroupFilterIds.includes(group.id));

    for (const group of activeGroups) {
      if (!trackedOnly && !group.visibleOnMap) {
        continue;
      }
      for (const mmsi of group.mmsis) {
        next.add(mmsi);
      }
    }
    return next;
  }, [groups, trackedGroupFilterIds]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const source = new VectorSource({ wrapX: false });
    const trailSource = new VectorSource({ wrapX: false });
    const trailLayer = new VectorLayer({
      source: trailSource,
      zIndex: SHIP_TRAIL_LAYER_Z_INDEX,
      visible: true,
    });
    const layer = new VectorLayer({
      source,
      zIndex: SHIP_LAYER_Z_INDEX,
      visible: true,
    });

    map.addLayer(trailLayer);
    map.addLayer(layer);
    sourceRef.current = source;
    trailSourceRef.current = trailSource;
    layerRef.current = layer;
    trailLayerRef.current = trailLayer;
    const snapshot = useShipStore.getState();
    const layerSnapshot = useShipLayerStore.getState();
    const trackedSnapshot = useTrackedShipStore.getState();
    const filteredTrackedSnapshot = trackedGroupFilterIds.length === 0
      ? new Set(
        trackedSnapshot.groups
          .filter((group) => trackedOnly || group.visibleOnMap)
          .flatMap((group) => group.mmsis),
      )
      : new Set(
        trackedSnapshot.groups
          .filter((group) => trackedGroupFilterIds.includes(group.id) && (trackedOnly || group.visibleOnMap))
          .flatMap((group) => group.mmsis),
      );
    layer.setVisible(layerSnapshot.visible.ships);
    trailLayer.setVisible(layerSnapshot.visible.trail);
    syncFeatures(
      source,
      layerSnapshot.trackedOnly
        ? pickShipsByMmsi(snapshot.ships, filteredTrackedSnapshot)
        : snapshot.ships,
      snapshot.selectedMmsi,
      layerSnapshot.visible.labels,
      trackedSnapshot.trackedMmsis,
    );
    syncTrailFeatures(
      trailSource,
      layerSnapshot.visible.trail ? snapshot.trailRoutes : {},
      layerSnapshot.visible.trail ? snapshot.trailRouteOrder : [],
      layerSnapshot.visible.trail ? snapshot.activeTrailRouteKey : null,
    );

    return () => {
      map.removeLayer(layer);
      map.removeLayer(trailLayer);
      source.clear();
      trailSource.clear();
      sourceRef.current = null;
      trailSourceRef.current = null;
      layerRef.current = null;
      trailLayerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) {
      return;
    }
    layerRef.current?.setVisible(shipLayers.ships);
    syncFeatures(
      source,
      shipLayers.ships
        ? trackedOnly
          ? pickShipsByMmsi(ships, visibleTrackedMmsis)
          : ships
        : {},
      selectedMmsi,
      shipLayers.labels,
      trackedMmsis,
    );
  }, [shipLayers.labels, shipLayers.ships, selectedMmsi, ships, trackedGroupFilterIds, trackedMmsis, trackedOnly, visibleTrackedMmsis]);

  useEffect(() => {
    const source = trailSourceRef.current;
    if (!source) {
      return;
    }
    trailLayerRef.current?.setVisible(shipLayers.trail);
    syncTrailFeatures(
      source,
      shipLayers.trail ? trailRoutes : {},
      shipLayers.trail ? trailRouteOrder : [],
      shipLayers.trail ? activeTrailRouteKey : null,
    );
  }, [activeTrailRouteKey, shipLayers.trail, trailRouteOrder, trailRoutes]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const handleClick = (event: MapBrowserEvent<PointerEvent>): void => {
      const trailHit = map.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => feature,
        { layerFilter: (layer) => layer === trailLayerRef.current },
      );

      const routeKey = trailHit?.get("routeKey") as string | undefined;
      const trailMmsi = trailHit?.get("mmsi") as string | undefined;
      if (routeKey && trailMmsi) {
        setActiveTrailRoute(routeKey);
        selectShip(trailMmsi, "history");
        showDetails(trailMmsi, "history");
        return;
      }

      const shipHit = map.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => feature,
        { layerFilter: (layer) => layer === layerRef.current },
      );

      const mmsi = shipHit?.get("mmsi") as string | undefined;
      selectShip(mmsi ?? null);
    };

    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    map.on("click", handleClick);
    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    return () => map.un("click", handleClick);
  }, [map, selectShip, setActiveTrailRoute, showDetails]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const targetElement = map.getTargetElement?.();

    const handlePointerMove = (event: MapBrowserEvent<PointerEvent> & { dragging?: boolean }): void => {
      if (event.dragging) {
        setHovered(null);
        if (targetElement) {
          targetElement.style.cursor = "";
        }
        return;
      }

      const hit = map.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => feature,
        { layerFilter: (layer) => layer === layerRef.current },
      );

      const mmsi = hit?.get("mmsi") as string | undefined;
      if (!mmsi) {
        setHovered(null);
        if (targetElement) {
          targetElement.style.cursor = "";
        }
        return;
      }

      setHovered({ mmsi, pixel: [event.pixel[0], event.pixel[1]] });
      if (targetElement) {
        targetElement.style.cursor = "pointer";
      }
    };

    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    map.on("pointermove", handlePointerMove);
    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    return () => {
      map.un("pointermove", handlePointerMove);
      if (targetElement) {
        targetElement.style.cursor = "";
      }
    };
  }, [map]);

  const hoveredShip = hovered ? ships[hovered.mmsi] ?? null : null;

  if (!hovered || !hoveredShip) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-[18] min-w-[140px] rounded border border-teal-400/30 bg-slate-950/95 px-2 py-1 text-xs text-slate-100 shadow-lg"
      data-testid="ship-hover-tooltip"
      style={{
        left: `${hovered.pixel[0] + 12}px`,
        top: `${hovered.pixel[1] + 12}px`,
      }}
    >
      <div className="font-mono font-semibold">{hoveredShip.mmsi}</div>
      {hoveredShip.vesselName ? <div className="text-slate-300">{hoveredShip.vesselName}</div> : null}
      {hoveredShip.vesselType ? <div className="text-slate-400">{hoveredShip.vesselType}</div> : null}
    </div>
  );
}
