import { useEffect, useRef, useState } from "react";
import type { FeatureLike } from "ol/Feature";
import type { MapBrowserEvent } from "ol";
import { Feature } from "ol";
import { Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { useMapContext } from "../../map/context/MapContext";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";
import { resolveShape } from "../db/iconResolver";
import { createAircraftStyle } from "../render/aircraftStyle";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";

export type AircraftLayerFilter = "all" | "watchlist" | "military";

type AircraftMapLayerProps = {
  visible?: boolean;
  filter?: AircraftLayerFilter;
  variant?: "live" | "watchlist" | "military";
  interactive?: boolean;
};

type HoverState = {
  icao: string;
  pixel: [number, number];
};

const LIVE_LAYER_Z_INDEX = 10;
const WATCHLIST_LAYER_Z_INDEX = 11;
const MILITARY_LAYER_Z_INDEX = 12;
const MILITARY_FILL_COLOR = "#ef4444";
const MILITARY_STROKE_COLOR = "#fbbf24";

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

export function shouldRenderAircraft(
  aircraft: Aircraft,
  filter: AircraftLayerFilter,
  watchlistIcaos: Set<string>,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "watchlist") {
    return watchlistIcaos.has(aircraft.icao.toLowerCase());
  }
  return aircraft.isMilitary;
}

function createStyleOptions(
  aircraft: Aircraft,
  isSelected: boolean,
  now: number,
  variant: "live" | "watchlist" | "military",
  watchlistColors: Map<string, string>,
): Parameters<typeof createAircraftStyle>[0] {
  const { shape, scale } = resolveShape(aircraft.aircraftType);
  const watchlistColor = watchlistColors.get(aircraft.icao.toLowerCase()) ?? "#38bdf8";

  if (variant === "military") {
    return {
      shape,
      scale: scale * 1.1,
      heading: aircraft.heading,
      altitude: aircraft.altitude,
      isSelected,
      opacity: Math.max(getAircraftOpacity(aircraft.lastSeen, now), 0.9),
      fillColor: MILITARY_FILL_COLOR,
      strokeColor: MILITARY_STROKE_COLOR,
    };
  }

  return {
    shape,
    scale: variant === "watchlist" ? scale * 1.15 : scale,
    heading: aircraft.heading,
    altitude: aircraft.altitude,
    isSelected,
    opacity:
      variant === "watchlist"
        ? Math.max(getAircraftOpacity(aircraft.lastSeen, now), 0.95)
        : getAircraftOpacity(aircraft.lastSeen, now),
    fillColor: variant === "watchlist" ? watchlistColor : undefined,
    strokeColor: variant === "watchlist" ? "#f8fafc" : undefined,
  };
}

function buildFeature(
  aircraft: Aircraft,
  isSelected: boolean,
  now: number,
  variant: "live" | "watchlist" | "military",
  watchlistColors: Map<string, string>,
): Feature<Point> {
  const style = createAircraftStyle(createStyleOptions(aircraft, isSelected, now, variant, watchlistColors));

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
  filter: AircraftLayerFilter,
  watchlistIcaos: Set<string>,
  variant: "live" | "watchlist" | "military",
  watchlistColors: Map<string, string>,
): void {
  const now = Date.now();
  const visibleAircraft = Object.values(aircraftMap).filter((aircraft) =>
    shouldRenderAircraft(aircraft, filter, watchlistIcaos),
  );
  const nextIcaos = new Set(visibleAircraft.map((aircraft) => aircraft.icao));

  source.getFeatures().forEach((feature) => {
    const id = feature.getId() as string;
    if (!nextIcaos.has(id)) {
      source.removeFeature(feature);
    }
  });

  for (const aircraft of visibleAircraft) {
    const isSelected = aircraft.icao === selectedIcao;
    const existing = source.getFeatureById(aircraft.icao) as Feature<Point> | null;
    if (existing) {
      existing.getGeometry()?.setCoordinates(fromLonLat([aircraft.lon, aircraft.lat]));
      existing.setStyle(createAircraftStyle(createStyleOptions(aircraft, isSelected, now, variant, watchlistColors)));
    } else {
      source.addFeature(buildFeature(aircraft, isSelected, now, variant, watchlistColors));
    }
  }
}

export function AircraftMapLayer({
  visible = true,
  filter = "all",
  variant = "live",
  interactive = true,
}: AircraftMapLayerProps): JSX.Element | null {
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectedIcao = useAircraftStore((state) => state.selectedIcao);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const watchlistGroups = useWatchlistStore((state) => state.groups);

  const watchlistIcaos = new Set<string>();
  const watchlistColors = new Map<string, string>();
  for (const group of watchlistGroups) {
    if (!group.visibleOnMap || !group.entries) {
      continue;
    }
    for (const entry of group.entries) {
      const normalizedIcao = entry.icao.toLowerCase();
      watchlistIcaos.add(normalizedIcao);
      if (!watchlistColors.has(normalizedIcao)) {
        watchlistColors.set(normalizedIcao, group.color);
      }
    }
  }

  useEffect(() => {
    if (!map) return;

    const source = new VectorSource({ wrapX: false });
    const layer = new VectorLayer({
      source,
      zIndex:
        variant === "military"
          ? MILITARY_LAYER_Z_INDEX
          : variant === "watchlist"
            ? WATCHLIST_LAYER_Z_INDEX
            : LIVE_LAYER_Z_INDEX,
      visible,
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
  }, [map, variant]);

  useEffect(() => {
    layerRef.current?.setVisible(visible);
    if (!visible) {
      setHovered(null);
    }
  }, [visible]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    syncFeatures(source, aircraft, selectedIcao, filter, watchlistIcaos, variant, watchlistColors);
  }, [aircraft, selectedIcao, filter, variant, watchlistGroups]);

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
        const state = useAircraftStore.getState();
        syncFeatures(
          source,
          state.aircraft,
          state.selectedIcao,
          filter,
          useWatchlistStore.getState().getVisibleIcaos(),
          variant,
          buildWatchlistColorMap(),
        );
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [filter, variant]);

  useEffect(() => {
    if (!map || !interactive || !visible) return;

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

    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    map.on("click", handleClick);
    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    return () => map.un("click", handleClick);
  }, [interactive, visible, map, selectAircraft]);

  useEffect(() => {
    if (!map || !interactive || !visible) {
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

      const icao = hit?.get("icao") as string | undefined;
      if (!icao) {
        setHovered(null);
        if (targetElement) {
          targetElement.style.cursor = "";
        }
        return;
      }

      setHovered({
        icao,
        pixel: [event.pixel[0], event.pixel[1]],
      });
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
  }, [interactive, map, visible]);

  const hoveredAircraft = hovered ? aircraft[hovered.icao] ?? null : null;

  if (!interactive || !visible || !hovered || !hoveredAircraft) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-[18] min-w-[120px] rounded border border-slate-600 bg-slate-900/95 px-2 py-1 text-xs text-slate-100 shadow-lg"
      data-testid="aircraft-hover-tooltip"
      style={{
        left: `${hovered.pixel[0] + 12}px`,
        top: `${hovered.pixel[1] + 12}px`,
      }}
    >
      <div className="font-mono font-semibold">{hoveredAircraft.icao.toUpperCase()}</div>
      {hoveredAircraft.callsign ? (
        <div className="text-slate-300">{hoveredAircraft.callsign}</div>
      ) : null}
    </div>
  );
}

function buildWatchlistColorMap(): Map<string, string> {
  const colors = new Map<string, string>();
  for (const group of useWatchlistStore.getState().groups) {
    if (!group.visibleOnMap || !group.entries) {
      continue;
    }
    for (const entry of group.entries) {
      const normalizedIcao = entry.icao.toLowerCase();
      if (!colors.has(normalizedIcao)) {
        colors.set(normalizedIcao, group.color);
      }
    }
  }
  return colors;
}

export { getAircraftOpacity };
