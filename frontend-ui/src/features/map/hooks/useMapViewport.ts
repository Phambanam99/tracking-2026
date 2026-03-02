import { useEffect, useState } from "react";
import { toLonLat } from "ol/proj";
import type { Extent } from "ol/extent";
import { useMapContext } from "../context/MapContext";
import type { LonLatExtent } from "../types/mapTypes";

function extentToLonLat(extent: Extent): LonLatExtent {
  const [west, south] = toLonLat([extent[0], extent[1]]);
  const [east, north] = toLonLat([extent[2], extent[3]]);
  return { west, south, east, north };
}

/**
 * Returns the current map viewport extent in WGS-84 coordinates, updated on every
 * pan / zoom. Returns null until the map is mounted.
 */
export function useMapViewport(): LonLatExtent | null {
  const { map } = useMapContext();
  const [viewport, setViewport] = useState<LonLatExtent | null>(null);

  useEffect(() => {
    if (!map) {
      return;
    }

    const update = (): void => {
      const size = map.getSize();
      if (!size) {
        return;
      }
      const extent = map.getView().calculateExtent(size);
      setViewport(extentToLonLat(extent));
    };

    map.on("moveend", update);
    update();

    return () => {
      map.un("moveend", update);
    };
  }, [map]);

  return viewport;
}
