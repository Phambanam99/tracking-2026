import { useEffect, useRef } from "react";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { fromLonLat } from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import type OlMap from "ol/Map";
import type { MapBrowserEvent } from "ol";
import type { FeatureLike } from "ol/Feature";
import { useMapContext } from "../../map/context/MapContext";
import { useAircraftStore } from "../store/useAircraftStore";
import { resolveShape } from "../db/iconResolver";
import { createAircraftStyle } from "../render/aircraftStyle";
import type { Aircraft } from "../types/aircraftTypes";

const LAYER_Z_INDEX = 10;

function getAircraftOpacity(lastSeen: number, now: number): number {
  const ageMs = now - lastSeen;
  if (ageMs < 60_000) {
    return 1.0;
  }
  if (ageMs < 180_000) {
    return 0.5;
  }
  return 0.25;
}

function buildFeature(aircraft: Aircraft, isSelected: boolean, now: number): Feature<Point> {
  const { shape, scale } = resolveShape(aircraft.aircraftType);
  const style = createAircraftStyle({
    shape,
    scale,
    heading: aircraft.heading,
    altitude: aircraft.altitude,
    isSelected,
    opacity: getAircraftOpacity(aircraft.lastSeen, now),
  });

  const feature = new Feature<Point>({
    geometry: new Point(fromLonLat([aircraft.lon, aircraft.lat])),
    icao: aircraft.icao,
  });
  feature.setId(aircraft.icao);
  feature.setStyle(style);
  return feature;
}

function syncFeatures(
  source: VectorSource,
  aircraftMap: Record<string, Aircraft>,
  selectedIcao: string | null,
): void {
  const now = Date.now();
  const nextIcaos = new Set(Object.keys(aircraftMap));

  // Remove stale features
  source.getFeatures().forEach((f) => {
    const id = f.getId() as string;
    if (!nextIcaos.has(id)) {
      source.removeFeature(f);
    }
  });

  // Add or update features
  for (const aircraft of Object.values(aircraftMap)) {
    const isSelected = aircraft.icao === selectedIcao;
    const existing = source.getFeatureById(aircraft.icao) as Feature<Point> | null;
    if (existing) {
      // Update position
      existing.getGeometry()?.setCoordinates(fromLonLat([aircraft.lon, aircraft.lat]));
      // Update style (heading, altitude, selection may have changed)
      const { shape, scale } = resolveShape(aircraft.aircraftType);
      existing.setStyle(
        createAircraftStyle({
          shape,
          scale,
          heading: aircraft.heading,
          altitude: aircraft.altitude,
          isSelected,
          opacity: getAircraftOpacity(aircraft.lastSeen, now),
        }),
      );
    } else {
      source.addFeature(buildFeature(aircraft, isSelected, now));
    }
  }
}

/**
 * Renders all tracked aircraft on the map as OpenLayers vector features.
 * Syncs with the Zustand aircraft store and handles click-to-select.
 * Must be rendered as a child of MapContainer (needs MapContext).
 */
export function AircraftMapLayer(): null {
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);

  // Bootstrap the OL layer once
  useEffect(() => {
    if (!map) return;

    const source = new VectorSource({ wrapX: false });
    const layer = new VectorLayer({
      source,
      zIndex: LAYER_Z_INDEX,
    });

    map.addLayer(layer);
    sourceRef.current = source;
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      source.clear();
      sourceRef.current = null;
      layerRef.current = null;
    };
  }, [map]);

  // Sync features whenever the aircraft store changes
  const aircraft = useAircraftStore((s) => s.aircraft);
  const selectedIcao = useAircraftStore((s) => s.selectedIcao);
  const selectAircraft = useAircraftStore((s) => s.selectAircraft);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    syncFeatures(source, aircraft, selectedIcao);
  }, [aircraft, selectedIcao]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) {
      return;
    }

    let frameId = 0;
    let lastOpacityRefreshAt = 0;

    const tick = (now: number): void => {
      if (now - lastOpacityRefreshAt >= 2_000) {
        lastOpacityRefreshAt = now;
        syncFeatures(source, useAircraftStore.getState().aircraft, useAircraftStore.getState().selectedIcao);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  // Click handler: select aircraft
  useEffect(() => {
    if (!map) return;

    const handleClick = (event: MapBrowserEvent<PointerEvent>): void => {
      const hit = map.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => feature,
        { layerFilter: (layer) => layer === layerRef.current },
      );

      if (hit) {
        const icao = hit.get("icao") as string | undefined;
        selectAircraft(icao ?? null);
      } else {
        selectAircraft(null);
      }
    };

    // @ts-expect-error – OL 10 overload resolution picks array variant; handler types are correct
    map.on("click", handleClick);
    // @ts-expect-error – OL 10 overload resolution picks array variant
    return () => map.un("click", handleClick);
  }, [map, selectAircraft]);

  return null;
}

export { getAircraftOpacity };
