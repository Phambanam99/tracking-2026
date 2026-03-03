import { useEffect, useState } from "react";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { toLonLat } from "ol/proj";
import { useMapContext } from "../context/MapContext";
import { useI18n } from "../../../shared/i18n/I18nProvider";

/**
 * MapStatusBar – thin footer below the map canvas showing current mouse
 * coordinates (WGS-84) and the current zoom level.
 */
export function MapStatusBar(): JSX.Element {
  const { map } = useMapContext();
  const { t } = useI18n();
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
    <div className="glass-panel pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full px-2.5 py-2 text-[11px] text-slate-300 shadow-xl">
      <TelemetryPill label={t("status.cursor")} value={lonStr ? `${latStr} / ${lonStr}` : latStr} />
      {zoom != null ? <TelemetryPill label={t("status.zoom")} value={zoom.toFixed(1)} /> : null}
    </div>
  );
}

type TelemetryPillProps = {
  label: string;
  value: string;
};

function TelemetryPill({ label, value }: TelemetryPillProps): JSX.Element {
  return (
    <span className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 font-mono">
      <span className="mr-1 uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <span className="text-slate-100">{value}</span>
    </span>
  );
}
