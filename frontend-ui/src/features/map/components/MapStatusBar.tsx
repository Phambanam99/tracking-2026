import { useEffect, useState } from "react";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { toLonLat } from "ol/proj";
import { useMapContext } from "../context/MapContext";

/**
 * MapStatusBar – thin footer below the map canvas showing current mouse
 * coordinates (WGS-84) and the current zoom level.
 */
export function MapStatusBar(): JSX.Element {
  const { map } = useMapContext();
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map) {
      return;
    }

    const onPointerMove = (event: MapBrowserEvent<PointerEvent>): void => {
      const [lon, lat] = toLonLat(event.coordinate);
      setCoords([lon, lat]);
    };

    const onMoveEnd = (): void => {
      setZoom(map.getView().getZoom() ?? null);
    };

    // @ts-expect-error – OL 10 overload resolution picks array variant; handler types are correct
    map.on("pointermove", onPointerMove);
    map.on("moveend", onMoveEnd);

    // Sync initial zoom
    setZoom(map.getView().getZoom() ?? null);

    return () => {
      // @ts-expect-error – OL 10 overload resolution picks array variant
      map.un("pointermove", onPointerMove);
      map.un("moveend", onMoveEnd);
    };
  }, [map]);

  const latStr =
    coords != null
      ? `${Math.abs(coords[1]).toFixed(4)}°${coords[1] >= 0 ? "N" : "S"}`
      : "—";
  const lonStr =
    coords != null
      ? `${Math.abs(coords[0]).toFixed(4)}°${coords[0] >= 0 ? "E" : "W"}`
      : "";

  return (
    <div className="flex items-center gap-4 border-t border-slate-700 bg-slate-900/95 px-3 py-1 font-mono text-xs text-slate-400">
      <span>
        {latStr}
        {lonStr ? ` / ${lonStr}` : ""}
      </span>
      {zoom != null && <span>Zoom: {zoom.toFixed(1)}</span>}
    </div>
  );
}
