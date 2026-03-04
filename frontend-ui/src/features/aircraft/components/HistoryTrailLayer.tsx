import { useEffect, useRef } from "react";
import { Feature } from "ol";
import type { FeatureLike } from "ol/Feature";
import type { MapBrowserEvent } from "ol";
import type Geometry from "ol/geom/Geometry";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { useMapContext } from "../../map/context/MapContext";
import { splitRouteSegments } from "../../map/render/splitRouteSegments";
import {
  createRouteActiveStyle,
  createRouteBaseStyle,
  createRouteCurrentPointStyle,
} from "../render/routeStyle";
import { useAircraftStore } from "../store/useAircraftStore";

const TRAIL_LAYER_Z_INDEX = 9;
const AIRCRAFT_ROUTE_MAX_GAP_MS = 20 * 60 * 1000;
const AIRCRAFT_ROUTE_MAX_SPEED_KTS = 1200;

type HistoryTrailLayerProps = {
  visible?: boolean;
};

export function HistoryTrailLayer({ visible = true }: HistoryTrailLayerProps): null {
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
  const sourceRef = useRef<VectorSource<Feature<Geometry>> | null>(null);
  const trailIcao = useAircraftStore((state) => state.trailIcao);
  const trailPlaybackIndex = useAircraftStore((state) => state.trailPlaybackIndex);
  const trailRouteOrder = useAircraftStore((state) => state.trailRouteOrder);
  const trailRoutes = useAircraftStore((state) => state.trailRoutes);
  const setActiveTrail = useAircraftStore((state) => state.setActiveTrail);

  useEffect(() => {
    if (!map) {
      return;
    }

    const source = new VectorSource<Feature<Geometry>>({ wrapX: false });
    const layer = new VectorLayer({
      source,
      zIndex: TRAIL_LAYER_Z_INDEX,
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
  }, [map, visible]);

  useEffect(() => {
    layerRef.current?.setVisible(visible);
  }, [visible]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) {
      return;
    }

    source.clear();

    for (const icao of trailRouteOrder) {
      const route = trailRoutes[icao];
      if (!route || route.positions.length === 0) {
        continue;
      }

      const segments = splitRouteSegments(route.positions, {
        maxGapMs: AIRCRAFT_ROUTE_MAX_GAP_MS,
        maxSpeedKts: AIRCRAFT_ROUTE_MAX_SPEED_KTS,
      });
      if (icao !== trailIcao) {
        segments.forEach((segment, segmentIndex) => {
          if (segment.length < 2) {
            return;
          }
          const baseLineFeature = new Feature(new LineString(segment.map((position) => fromLonLat([position.lon, position.lat]))));
          baseLineFeature.setId(`history-trail-${icao}-base-${segmentIndex}`);
          baseLineFeature.set("routeIcao", icao);
          baseLineFeature.setStyle(createRouteBaseStyle(route.color));
          source.addFeature(baseLineFeature as Feature<Geometry>);
        });
        continue;
      }

      const coordinates = route.positions.map((position) => fromLonLat([position.lon, position.lat]));
      const playbackIndex = Math.max(0, Math.min(trailPlaybackIndex, coordinates.length - 1));
      const activePositions = route.positions.slice(0, playbackIndex + 1);
      const activeSegments = splitRouteSegments(activePositions, {
        maxGapMs: AIRCRAFT_ROUTE_MAX_GAP_MS,
        maxSpeedKts: AIRCRAFT_ROUTE_MAX_SPEED_KTS,
      });
      const currentCoordinate = coordinates[playbackIndex];

      activeSegments.forEach((segment, segmentIndex) => {
        if (segment.length < 2) {
          return;
        }
        const activeLineFeature = new Feature(new LineString(segment.map((position) => fromLonLat([position.lon, position.lat]))));
        activeLineFeature.setId(`history-trail-${icao}-active-${segmentIndex}`);
        activeLineFeature.set("routeIcao", icao);
        activeLineFeature.setStyle(createRouteActiveStyle(route.color));
        source.addFeature(activeLineFeature as Feature<Geometry>);
      });

      const currentPointFeature = new Feature(new Point(currentCoordinate));
      currentPointFeature.setId(`history-trail-${icao}-current`);
      currentPointFeature.set("routeIcao", icao);
      currentPointFeature.setStyle(createRouteCurrentPointStyle(route.color));
      source.addFeature(currentPointFeature as Feature<Geometry>);
    }
  }, [trailIcao, trailPlaybackIndex, trailRouteOrder, trailRoutes]);

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

      const routeIcao = hit?.get("routeIcao") as string | undefined;
      if (routeIcao) {
        setActiveTrail(routeIcao);
      }
    };

    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    map.on("click", handleClick);
    // @ts-expect-error OpenLayers overload typing is narrower than runtime usage.
    return () => map.un("click", handleClick);
  }, [map, setActiveTrail]);

  return null;
}
