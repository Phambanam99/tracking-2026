import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureLike } from "ol/Feature";
import type { MapBrowserEvent } from "ol";
import { Feature } from "ol";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { useMapContext } from "../../map/context/MapContext";
import { resolveShape } from "../../aircraft/db/iconResolver";
import { createAircraftStyle } from "../../aircraft/render/aircraftStyle";
import {
  createRouteActiveStyle,
  createRouteCurrentPointStyle,
} from "../../aircraft/render/routeStyle";
import { useAircraftStore } from "../../aircraft/store/useAircraftStore";
import type { Aircraft } from "../../aircraft/types/aircraftTypes";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { getCurrentPlaybackFrame, usePlaybackStore } from "../store/usePlaybackStore";

const PLAYBACK_LAYER_Z_INDEX = 13;
const PLAYBACK_TRAIL_MAX_POINTS = 12;
const PLAYBACK_TRAIL_LINE_ID = "playback-trail-line";
const PLAYBACK_TRAIL_POINT_ID = "playback-trail-point";

type HoverState = {
  icao: string;
  pixel: [number, number];
};

function buildPlaybackAircraftFeature(
  aircraft: Aircraft,
  isSelected: boolean,
): Feature<Point> {
  const { shape, scale } = resolveShape(aircraft.aircraftType);
  const feature = new Feature({
    geometry: new Point(fromLonLat([aircraft.lon, aircraft.lat])),
    icao: aircraft.icao,
  });
  feature.setId(aircraft.icao);
  feature.setStyle(
    createAircraftStyle({
      shape,
      scale,
      heading: aircraft.heading,
      altitude: aircraft.altitude,
      opacity: 0.95,
      isSelected,
    }),
  );
  return feature;
}

function syncPlaybackAircraftFeatures(
  source: VectorSource,
  aircraftList: Aircraft[],
  selectedIcao: string | null,
): void {
  const nextIcaos = new Set(aircraftList.map((aircraft) => aircraft.icao));

  source.getFeatures().forEach((feature) => {
    const id = feature.getId();
    if (typeof id !== "string") {
      return;
    }
    if (id === PLAYBACK_TRAIL_LINE_ID || id === PLAYBACK_TRAIL_POINT_ID) {
      return;
    }
    if (!nextIcaos.has(id)) {
      source.removeFeature(feature);
    }
  });

  for (const aircraft of aircraftList) {
    const existing = source.getFeatureById(aircraft.icao) as Feature<Point> | null;
    if (existing) {
      existing.getGeometry()?.setCoordinates(fromLonLat([aircraft.lon, aircraft.lat]));
      const { shape, scale } = resolveShape(aircraft.aircraftType);
      existing.setStyle(
        createAircraftStyle({
          shape,
          scale,
          heading: aircraft.heading,
          altitude: aircraft.altitude,
          opacity: 0.95,
          isSelected: aircraft.icao === selectedIcao,
        }),
      );
    } else {
      source.addFeature(buildPlaybackAircraftFeature(aircraft, aircraft.icao === selectedIcao));
    }
  }
}

function resolvePlaybackTrailPoints(
  frames: Array<{ aircraft: Aircraft[] }>,
  currentFrameIndex: number,
  selectedIcao: string,
): Aircraft[] {
  const points: Aircraft[] = [];
  for (
    let index = Math.max(0, currentFrameIndex - PLAYBACK_TRAIL_MAX_POINTS + 1);
    index <= currentFrameIndex;
    index += 1
  ) {
    const match = frames[index]?.aircraft.find((aircraft) => aircraft.icao === selectedIcao);
    if (match) {
      points.push(match);
    }
  }
  return points;
}

function syncPlaybackTrailFeatures(
  source: VectorSource,
  frames: Array<{ aircraft: Aircraft[] }>,
  currentFrameIndex: number,
  selectedIcao: string | null,
): void {
  const lineFeature = source.getFeatureById(PLAYBACK_TRAIL_LINE_ID) as Feature<LineString> | null;
  const pointFeature = source.getFeatureById(PLAYBACK_TRAIL_POINT_ID) as Feature<Point> | null;

  if (!selectedIcao) {
    if (lineFeature) {
      source.removeFeature(lineFeature);
    }
    if (pointFeature) {
      source.removeFeature(pointFeature);
    }
    return;
  }

  const trailPoints = resolvePlaybackTrailPoints(frames, currentFrameIndex, selectedIcao);
  if (trailPoints.length < 2) {
    if (lineFeature) {
      source.removeFeature(lineFeature);
    }
    if (pointFeature) {
      source.removeFeature(pointFeature);
    }
    return;
  }

  const trailCoordinates = trailPoints.map((aircraft) => fromLonLat([aircraft.lon, aircraft.lat]));

  if (lineFeature) {
    lineFeature.getGeometry()?.setCoordinates(trailCoordinates);
  } else {
    const nextLineFeature = new Feature({
      geometry: new LineString(trailCoordinates),
    });
    nextLineFeature.setId(PLAYBACK_TRAIL_LINE_ID);
    nextLineFeature.setStyle(createRouteActiveStyle("#f59e0b"));
    source.addFeature(nextLineFeature);
  }

  const lastCoordinate = trailCoordinates[trailCoordinates.length - 1];
  if (pointFeature) {
    pointFeature.getGeometry()?.setCoordinates(lastCoordinate);
  } else {
    const nextPointFeature = new Feature({
      geometry: new Point(lastCoordinate),
    });
    nextPointFeature.setId(PLAYBACK_TRAIL_POINT_ID);
    nextPointFeature.setStyle(createRouteCurrentPointStyle("#f59e0b"));
    source.addFeature(nextPointFeature);
  }
}

export function PlaybackMapLayer(): JSX.Element | null {
  const { t } = useI18n();
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const selectedIcao = useAircraftStore((state) => state.selectedIcao);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const isBarVisible = usePlaybackStore((state) => state.isBarVisible);
  const status = usePlaybackStore((state) => state.status);
  const frames = usePlaybackStore((state) => state.frames);
  const currentFrameIndex = usePlaybackStore((state) => state.currentFrameIndex);
  const currentFrame = usePlaybackStore(getCurrentPlaybackFrame);

  const hoveredAircraft = useMemo(() => {
    if (!hovered || !currentFrame) {
      return null;
    }
    return currentFrame.aircraft.find((aircraft) => aircraft.icao === hovered.icao) ?? null;
  }, [currentFrame, hovered]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const source = new VectorSource({ wrapX: false });
    const layer = new VectorLayer({
      source,
      zIndex: PLAYBACK_LAYER_Z_INDEX,
      visible: isBarVisible && status === "ready",
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

  useEffect(() => {
    layerRef.current?.setVisible(isBarVisible && status === "ready");
    if (!isBarVisible || status !== "ready") {
      setHovered(null);
    }
  }, [isBarVisible, status]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) {
      return;
    }

    if (!isBarVisible || status !== "ready" || !currentFrame) {
      source.clear();
      return;
    }

    syncPlaybackAircraftFeatures(source, currentFrame.aircraft, selectedIcao);
    syncPlaybackTrailFeatures(source, frames, currentFrameIndex, selectedIcao);
  }, [currentFrame, currentFrameIndex, frames, isBarVisible, selectedIcao, status]);

  useEffect(() => {
    if (!map || !isBarVisible || status !== "ready") {
      return;
    }

    const handleClick = (event: MapBrowserEvent<PointerEvent>): void => {
      const hit = map.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => feature,
        { layerFilter: (layer) => layer === layerRef.current },
      );

      const icao = hit?.get("icao") as string | undefined;
      if (icao) {
        selectAircraft(icao);
      } else {
        setHovered(null);
      }
    };

    // @ts-expect-error OpenLayers runtime supports this event binding.
    map.on("click", handleClick);
    // @ts-expect-error OpenLayers runtime supports this event binding.
    return () => map.un("click", handleClick);
  }, [isBarVisible, map, selectAircraft, status]);

  useEffect(() => {
    if (!map || !isBarVisible || status !== "ready") {
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

      setHovered({ icao, pixel: [event.pixel[0], event.pixel[1]] });
      if (targetElement) {
        targetElement.style.cursor = "pointer";
      }
    };

    // @ts-expect-error OpenLayers runtime supports this event binding.
    map.on("pointermove", handlePointerMove);
    // @ts-expect-error OpenLayers runtime supports this event binding.
    return () => {
      map.un("pointermove", handlePointerMove);
      if (targetElement) {
        targetElement.style.cursor = "";
      }
    };
  }, [isBarVisible, map, status]);

  if (!isBarVisible || status !== "ready" || !hovered || !hoveredAircraft) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-[18] min-w-[120px] rounded border border-amber-500/60 bg-slate-950/95 px-2 py-1 text-xs text-slate-100 shadow-lg"
      data-testid="playback-hover-tooltip"
      style={{
        left: `${hovered.pixel[0] + 12}px`,
        top: `${hovered.pixel[1] + 12}px`,
      }}
    >
      <div className="font-mono font-semibold">{hoveredAircraft.icao.toUpperCase()}</div>
      {hoveredAircraft.callsign ? (
        <div className="text-slate-300">{hoveredAircraft.callsign}</div>
      ) : null}
      <div className="text-[10px] text-amber-300">{t("aircraft.popup.playbackSnapshot")}</div>
    </div>
  );
}
