import { useLayoutEffect, useRef } from "react";
import { fromLonLat } from "ol/proj";
import { useShallow } from "zustand/react/shallow";
import { useMapContext } from "../../map/context/MapContext";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useShipStore } from "../store/useShipStore";

function formatCoordinate(value: number, positiveSuffix: string, negativeSuffix: string): string {
  return `${Math.abs(value).toFixed(4)} ${value >= 0 ? positiveSuffix : negativeSuffix}`;
}

function formatSpeed(knots: number | null): string {
  return knots == null ? "-" : `${Math.round(knots)} kts`;
}

function formatHeading(degrees: number | null): string {
  return degrees == null ? "-" : `${Math.round(degrees)} deg`;
}

export function ShipPopup(): JSX.Element {
  const { map, mapContainerEl } = useMapContext();
  const popupRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const { selectedMmsi, ship, selectedMode, selectShip, showDetails } = useShipStore(
    useShallow((state) => ({
      selectedMmsi: state.selectedMmsi,
      ship: state.selectedMmsi ? state.ships[state.selectedMmsi] : null,
      selectedMode: state.selectedMode,
      selectShip: state.selectShip,
      showDetails: state.showDetails,
    })),
  );
  const { t } = useI18n();

  useLayoutEffect(() => {
    const connectorEl = connectorRef.current;
    if (!connectorEl) {
      return;
    }

    if (!map || !mapContainerEl || !popupRef.current || !ship) {
      connectorEl.style.display = "none";
      return;
    }

    const updateLine = (): void => {
      if (!popupRef.current || !mapContainerEl || !connectorRef.current) {
        return;
      }

      const popupRect = popupRef.current.getBoundingClientRect();
      const mapRect = mapContainerEl.getBoundingClientRect();
      const pixel = map.getPixelFromCoordinate(fromLonLat([ship.lon, ship.lat]));
      if (!pixel) {
        connectorRef.current.style.display = "none";
        return;
      }

      connectorRef.current.setAttribute("x1", String(popupRect.right - mapRect.left));
      connectorRef.current.setAttribute("y1", String(popupRect.bottom - mapRect.top));
      connectorRef.current.setAttribute("x2", String(pixel[0]));
      connectorRef.current.setAttribute("y2", String(pixel[1]));
      connectorRef.current.style.display = "block";
    };

    updateLine();
    map.on("postrender", updateLine);
    window.addEventListener("resize", updateLine);

    return () => {
      map.un("postrender", updateLine);
      window.removeEventListener("resize", updateLine);
    };
  }, [map, mapContainerEl, ship]);

  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[19]" data-testid="ship-popup-connector">
        <line
          ref={connectorRef}
          opacity="0.7"
          stroke="#2dd4bf"
          strokeDasharray="6 4"
          strokeWidth="1.5"
          style={{ display: "none" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 z-20" data-testid="ship-popup">
        {selectedMmsi && ship ? (
          <div ref={popupRef} className="pointer-events-auto absolute left-3 top-12 max-w-[20rem]">
            <div className="glass-panel relative rounded-[22px] p-3.5 text-sm text-slate-100 shadow-glass">
              <button
                aria-label={t("ship.popup.close")}
                className="absolute right-2 top-2 text-slate-400 hover:text-white"
                onClick={() => selectShip(null)}
                type="button"
              >
                x
              </button>
              <div className="mb-3 border-b border-slate-700/80 pb-3 pr-6">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{ship.vesselName ?? ship.mmsi}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    ship.isHistorical
                      ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                      : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                  }`}>
                    {ship.isHistorical ? t("ship.detail.badge.history") : t("ship.detail.badge.live")}
                  </span>
                  {ship.metadata?.isMilitary ? (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                      {t("ship.military")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-300">{ship.vesselType ?? ship.metadata?.shipTypeName ?? "-"}</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {selectedMode === "history"
                    ? t("ship.detail.context.history")
                    : selectedMode === "global"
                      ? t("ship.detail.context.global")
                      : selectedMode === "viewport"
                        ? t("ship.detail.context.viewport")
                        : ship.isHistorical
                          ? t("ship.detail.snapshotHistory")
                          : t("ship.detail.snapshotLive")}
                </p>
              </div>

              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="pr-2 text-slate-400">{t("ship.field.mmsi")}</td>
                    <td className="font-mono">{ship.mmsi}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-slate-400">{t("ship.field.speed")}</td>
                    <td>{formatSpeed(ship.speed)}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-slate-400">{t("ship.field.heading")}</td>
                    <td>{formatHeading(ship.heading ?? ship.course)}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-slate-400">{t("ship.field.position")}</td>
                    <td>{formatCoordinate(ship.lat, "N", "S")} {formatCoordinate(ship.lon, "E", "W")}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-slate-400">{t("ship.field.destination")}</td>
                    <td>{ship.destination ?? "-"}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3">
                <button
                  className="w-full rounded border border-cyan-500 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/10"
                  onClick={() => showDetails(ship.mmsi, selectedMode)}
                  type="button"
                >
                  {t("ship.popup.viewDetails")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
