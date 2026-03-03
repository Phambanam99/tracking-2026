import { useEffect, useRef } from "react";
import { Feature } from "ol";
import type Geometry from "ol/geom/Geometry";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { useMapContext } from "../../map/context/MapContext";
import {
  createRouteActiveStyle,
  createRouteBaseStyle,
  createRouteCurrentPointStyle,
} from "../render/routeStyle";
import { useAircraftStore } from "../store/useAircraftStore";

const TRAIL_LAYER_Z_INDEX = 9;

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

      const coordinates = route.positions.map((position) => fromLonLat([position.lon, position.lat]));
      if (icao !== trailIcao) {
        const baseLineFeature = new Feature(new LineString(coordinates));
        baseLineFeature.setId(`history-trail-${icao}-base`);
        baseLineFeature.setStyle(createRouteBaseStyle(route.color));
        source.addFeature(baseLineFeature as Feature<Geometry>);
        continue;
      }

      const playbackIndex = Math.max(0, Math.min(trailPlaybackIndex, coordinates.length - 1));
      const activeCoordinates = coordinates.slice(0, playbackIndex + 1);
      const currentCoordinate = coordinates[playbackIndex];

      const activeLineFeature = new Feature(new LineString(activeCoordinates));
      activeLineFeature.setId(`history-trail-${icao}-active`);
      activeLineFeature.setStyle(createRouteActiveStyle(route.color));
      source.addFeature(activeLineFeature as Feature<Geometry>);

      const currentPointFeature = new Feature(new Point(currentCoordinate));
      currentPointFeature.setId(`history-trail-${icao}-current`);
      currentPointFeature.setStyle(createRouteCurrentPointStyle(route.color));
      source.addFeature(currentPointFeature as Feature<Geometry>);
    }
  }, [trailIcao, trailPlaybackIndex, trailRouteOrder, trailRoutes]);

  return null;
}
