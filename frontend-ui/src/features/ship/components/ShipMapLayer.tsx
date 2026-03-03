import { useEffect, useRef, useState } from "react";
import type { FeatureLike } from "ol/Feature";
import type { MapBrowserEvent } from "ol";
import { Feature } from "ol";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import { useMapContext } from "../../map/context/MapContext";
import { useShipStore } from "../store/useShipStore";
import type { Ship } from "../types/shipTypes";

type HoverState = {
  mmsi: string;
  pixel: [number, number];
};

const SHIP_LAYER_Z_INDEX = 10;
const SHIP_TRAIL_LAYER_Z_INDEX = 9;

function createShipStyle(ship: Ship): Style {
  const fillColor = ship.metadata?.isMilitary ? "#f97316" : "#14b8a6";
  const strokeColor = ship.metadata?.isMilitary ? "#fed7aa" : "#ccfbf1";

  return new Style({
    image: new CircleStyle({
      radius: ship.metadata?.isMilitary ? 7 : 6,
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: strokeColor, width: 2 }),
    }),
    text: new Text({
      text: ship.vesselName ?? ship.mmsi,
      offsetY: 18,
      font: "600 11px ui-sans-serif",
      fill: new Fill({ color: "#e2e8f0" }),
      backgroundFill: new Fill({ color: "rgba(2, 6, 23, 0.72)" }),
      padding: [2, 4, 2, 4],
    }),
  });
}

function createSelectedShipStyle(ship: Ship): Style {
  const style = createShipStyle(ship);
  style.setImage(
    new CircleStyle({
      radius: ship.metadata?.isMilitary ? 8 : 7,
      fill: new Fill({ color: ship.metadata?.isMilitary ? "#ea580c" : "#0f766e" }),
      stroke: new Stroke({ color: "#f8fafc", width: 2.5 }),
    }),
  );
  return style;
}

function buildFeature(ship: Ship, isSelected: boolean): Feature<Point> {
  const feature = new Feature<Point>({
    geometry: new Point(fromLonLat([ship.lon, ship.lat])),
    mmsi: ship.mmsi,
  });
  feature.setId(ship.mmsi);
  feature.setStyle(isSelected ? createSelectedShipStyle(ship) : createShipStyle(ship));
  return feature;
}

function syncFeatures(source: VectorSource, shipMap: Record<string, Ship>, selectedMmsi: string | null): void {
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
    if (existing) {
      existing.getGeometry()?.setCoordinates(fromLonLat([ship.lon, ship.lat]));
      existing.setStyle(isSelected ? createSelectedShipStyle(ship) : createShipStyle(ship));
    } else {
      source.addFeature(buildFeature(ship, isSelected));
    }
  }
}

function createTrailStyle(): Style {
  return new Style({
    stroke: new Stroke({
      color: "rgba(129, 140, 248, 0.85)",
      width: 2.5,
    }),
  });
}

function syncTrailFeature(source: VectorSource, trailPoints: Array<{ lat: number; lon: number }>): void {
  const featureId = "__ship-history-trail__";
  const existing = source.getFeatureById(featureId) as Feature<LineString> | null;

  if (trailPoints.length < 2) {
    if (existing) {
      source.removeFeature(existing);
    }
    return;
  }

  const coordinates = trailPoints.map((point) => fromLonLat([point.lon, point.lat]));
  if (existing) {
    existing.getGeometry()?.setCoordinates(coordinates);
    return;
  }

  const feature = new Feature<LineString>({
    geometry: new LineString(coordinates),
  });
  feature.setId(featureId);
  feature.setStyle(createTrailStyle());
  source.addFeature(feature);
}

export function ShipMapLayer(): JSX.Element | null {
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const trailSourceRef = useRef<VectorSource | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const ships = useShipStore((state) => state.ships);
  const selectedMmsi = useShipStore((state) => state.selectedMmsi);
  const selectShip = useShipStore((state) => state.selectShip);
  const trailPoints = useShipStore((state) => state.trailPoints);

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

    return () => {
      map.removeLayer(layer);
      map.removeLayer(trailLayer);
      source.clear();
      trailSource.clear();
      sourceRef.current = null;
      trailSourceRef.current = null;
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) {
      return;
    }
    syncFeatures(source, ships, selectedMmsi);
  }, [ships, selectedMmsi]);

  useEffect(() => {
    const source = trailSourceRef.current;
    if (!source) {
      return;
    }
    syncTrailFeature(source, trailPoints);
  }, [trailPoints]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const handleClick = (event: MapBrowserEvent<PointerEvent>): void => {
      const hit = map.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => feature,
        { layerFilter: (layer) => layer === layerRef.current },
      );

      const mmsi = hit?.get("mmsi") as string | undefined;
      selectShip(mmsi ?? null);
    };

    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    map.on("click", handleClick);
    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    return () => map.un("click", handleClick);
  }, [map, selectShip]);

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
