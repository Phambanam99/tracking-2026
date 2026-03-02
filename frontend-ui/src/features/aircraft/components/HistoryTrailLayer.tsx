import { useEffect, useRef } from "react";
import { Feature } from "ol";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { LineString, MultiPoint } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";
import type Geometry from "ol/geom/Geometry";
import { useMapContext } from "../../map/context/MapContext";
import { useAircraftStore } from "../store/useAircraftStore";

const TRAIL_LAYER_Z_INDEX = 9;
const TRAIL_LINE_ID = "history-trail-line";

function createTrailStyle(): Style[] {
  return [
    new Style({
      stroke: new Stroke({
        color: "#22d3ee",
        width: 2,
        lineDash: [4, 3],
      }),
    }),
    new Style({
      geometry: (feature) => {
        const geometry = feature.getGeometry();
        if (!(geometry instanceof LineString)) {
          return null;
        }

        const coordinates = geometry.getCoordinates();
        if (coordinates.length === 0) {
          return null;
        }

        const endpoints =
          coordinates.length === 1
            ? [coordinates[0]]
            : [coordinates[0], coordinates[coordinates.length - 1]];
        return new MultiPoint(endpoints);
      },
      image: new CircleStyle({
        radius: 3,
        fill: new Fill({ color: "#22d3ee" }),
        stroke: new Stroke({ color: "#083344", width: 1 }),
      }),
    }),
  ];
}

export function HistoryTrailLayer(): null {
  const { map } = useMapContext();
  const layerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
  const sourceRef = useRef<VectorSource<Feature<Geometry>> | null>(null);
  const trailIcao = useAircraftStore((state) => state.trailIcao);
  const trailPositions = useAircraftStore((state) => state.trailPositions);

  useEffect(() => {
    if (!map) {
      return;
    }

    const source = new VectorSource<Feature<Geometry>>({ wrapX: false });
    const layer = new VectorLayer({
      source,
      zIndex: TRAIL_LAYER_Z_INDEX,
      style: createTrailStyle(),
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
    const source = sourceRef.current;
    if (!source) {
      return;
    }

    if (!trailIcao || trailPositions.length === 0) {
      source.clear();
      return;
    }

    const coordinates = trailPositions.map((position) =>
      fromLonLat([position.lon, position.lat]),
    );

    let lineFeature = source.getFeatureById(TRAIL_LINE_ID) as Feature<LineString> | null;
    if (!lineFeature) {
      lineFeature = new Feature(new LineString(coordinates));
      lineFeature.setId(TRAIL_LINE_ID);
      source.addFeature(lineFeature as Feature<Geometry>);
    } else {
      lineFeature.getGeometry()?.setCoordinates(coordinates);
    }

  }, [trailIcao, trailPositions]);

  return null;
}
