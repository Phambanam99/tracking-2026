import { useEffect, useRef } from "react";
import { Feature } from "ol";
import { Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { useMapContext } from "../../map/context/MapContext";
import { useSearchStore } from "../store/useSearchStore";
import type { SearchResult } from "../types/searchTypes";

const SEARCH_HIGHLIGHT_Z_INDEX = 60;
const SEARCH_RESULT_RADIUS = 6;
const SEARCH_SELECTED_RADIUS = 8;

function buildSearchResultStyle(isSelected: boolean): Style {
  return new Style({
    image: new CircleStyle({
      radius: isSelected ? SEARCH_SELECTED_RADIUS : SEARCH_RESULT_RADIUS,
      fill: new Fill({ color: isSelected ? "#f97316" : "#22d3ee" }),
      stroke: new Stroke({
        color: isSelected ? "#fff7ed" : "#083344",
        width: isSelected ? 3 : 2,
      }),
    }),
  });
}

function syncSearchFeatures(
  source: VectorSource<Feature<Point>>,
  results: SearchResult[],
  selectedIcao: string | null,
): void {
  const nextIds = new Set(results.map((result) => result.icao));

  source.getFeatures().forEach((feature) => {
    const id = feature.getId() as string | undefined;
    if (!id || !nextIds.has(id)) {
      source.removeFeature(feature);
    }
  });

  for (const result of results) {
    const existing = source.getFeatureById(result.icao) as Feature<Point> | null;
    const coordinate = fromLonLat([result.lon, result.lat]);
    const isSelected = selectedIcao === result.icao;

    if (existing) {
      existing.getGeometry()?.setCoordinates(coordinate);
      existing.setStyle(buildSearchResultStyle(isSelected));
      continue;
    }

    const feature = new Feature<Point>({
      geometry: new Point(coordinate),
      icao: result.icao,
    });
    feature.setId(result.icao);
    feature.setStyle(buildSearchResultStyle(isSelected));
    source.addFeature(feature);
  }
}

export function SearchHighlightLayer(): null {
  const { map } = useMapContext();
  const results = useSearchStore((state) => state.results);
  const selectedIcao = useSearchStore((state) => state.selectedIcao);
  const sourceRef = useRef<VectorSource<Feature<Point>> | null>(null);
  const layerRef = useRef<VectorLayer<VectorSource<Feature<Point>>> | null>(null);

  useEffect(() => {
    if (!map) {
      return;
    }

    const source = new VectorSource<Feature<Point>>({ wrapX: false });
    const layer = new VectorLayer({
      source,
      zIndex: SEARCH_HIGHLIGHT_Z_INDEX,
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

    syncSearchFeatures(source, results, selectedIcao);
  }, [results, selectedIcao]);

  return null;
}

