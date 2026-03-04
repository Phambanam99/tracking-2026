import { useEffect, useRef, useState } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import {
  createBaseLayer,
  createBaseLayerByProviderId,
  type BaseLayer,
  type BaseLayerType,
} from "../layers/baseLayer";
import { DEFAULT_VIEWPORT, type MapViewport } from "../types/mapTypes";

export type UseOlMapOptions = {
  /** Initial center and zoom; defaults to Indochina / SEA region. */
  initialViewport?: Partial<MapViewport>;
  /** Base layer type; defaults to "osm". */
  baseLayerType?: BaseLayerType;
  /** Active provider id. When present, this takes precedence over legacy baseLayerType. */
  activeProviderId?: string;
};

function createEffectiveBaseLayer(options: UseOlMapOptions): BaseLayer {
  if (options.activeProviderId) {
    return createBaseLayerByProviderId(options.activeProviderId);
  }
  return createBaseLayer(options.baseLayerType);
}

/**
 * Initialises an OpenLayers Map on the provided container ref.
 *
 * @returns The OL Map instance once mounted, or null during SSR / before mount.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const map = useOlMap(containerRef);
 * ```
 */
export function useOlMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseOlMapOptions = {},
): OlMap<BaseLayer> | null {
  const [map, setMap] = useState<OlMap<BaseLayer> | null>(null);
  // Keep a stable ref so tear-down can access the same instance even after unmount.
  const mapRef = useRef<OlMap<BaseLayer> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const center = options.initialViewport?.center ?? DEFAULT_VIEWPORT.center;
    const zoom = options.initialViewport?.zoom ?? DEFAULT_VIEWPORT.zoom;

    const olMap = new OlMap<BaseLayer>({
      target: containerRef.current,
      layers: [createEffectiveBaseLayer(options)],
      view: new View({
        center: fromLonLat(center),
        zoom,
        minZoom: 2,
        maxZoom: 19,
      }),
    });

    mapRef.current = olMap;
    setMap(olMap);

    return () => {
      olMap.setTarget(undefined);
      mapRef.current = null;
      setMap(null);
    };
    // Intentionally omit options from deps: viewport changes are handled externally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const baseLayer = createEffectiveBaseLayer(options);
    mapRef.current.getLayers().setAt(0, baseLayer);
  }, [options.activeProviderId, options.baseLayerType]);

  return map;
}
