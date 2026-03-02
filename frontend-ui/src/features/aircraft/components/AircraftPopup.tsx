import { useLayoutEffect, useRef, useState } from "react";
import { fromLonLat } from "ol/proj";
import { AddToWatchlistDropdown } from "../../watchlist/components/AddToWatchlistDropdown";
import { useMapContext } from "../../map/context/MapContext";
import { useFlightHistory } from "../hooks/useFlightHistory";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";
import { getCountryName } from "../utils/countryDisplay";

function formatAlt(ft: number | null | undefined): string {
  if (ft == null) return "-";
  if (ft <= 0) return "Ground";
  return `${ft.toLocaleString()} ft`;
}

function formatSpeed(kts: number | null | undefined): string {
  if (kts == null) return "-";
  return `${Math.round(kts)} kts`;
}

function formatHeading(deg: number | null | undefined): string {
  if (deg == null) return "-";
  return `${Math.round(deg)} deg`;
}

function CountryBadge({
  countryCode,
}: {
  countryCode: string | null | undefined;
  countryFlagUrl?: string | null | undefined;
}): JSX.Element {
  const name = getCountryName(countryCode);
  if (name) {
    return <span className="text-xs text-slate-300">{name}</span>;
  }
  return <span className="text-xs text-slate-500">Unknown</span>;
}

function MilitaryBadge(): JSX.Element {
  return (
    <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
      Military
    </span>
  );
}

type PopupContentProps = {
  aircraft: Aircraft;
  onClose: () => void;
  onShowDetails: () => void;
  trailCount: number;
  trailActive: boolean;
  onClearTrail: () => void;
  onLoadTrail: (hoursBack: number) => void;
  isTrailLoading: boolean;
  trailError: string | null;
};

const TRAIL_MAX_HOURS = 168;

function PopupContent({
  aircraft,
  onClose,
  onShowDetails,
  trailCount,
  trailActive,
  onClearTrail,
  onLoadTrail,
  isTrailLoading,
  trailError,
}: PopupContentProps): JSX.Element {
  const [customHours, setCustomHours] = useState<string>("1");
  const parsedHours = Math.min(TRAIL_MAX_HOURS, Math.max(1, Math.round(Number(customHours) || 1)));

  return (
    <div className="relative min-w-[220px] rounded-lg border border-slate-600 bg-slate-800 p-3 text-sm text-slate-100 shadow-xl">
      <button
        aria-label="Close popup"
        className="absolute right-2 top-2 text-slate-400 hover:text-white"
        onClick={onClose}
        type="button"
      >
        x
      </button>

      <div className="mb-2 flex items-center gap-2 font-semibold">
        <CountryBadge countryCode={aircraft.countryCode} countryFlagUrl={aircraft.countryFlagUrl} />
        <span>{aircraft.callsign ?? aircraft.registration ?? aircraft.icao}</span>
        {aircraft.isMilitary ? <MilitaryBadge /> : null}
      </div>

      <table className="w-full text-xs">
        <tbody>
          {aircraft.registration ? (
            <tr>
              <td className="pr-2 text-slate-400">Reg</td>
              <td>{aircraft.registration}</td>
            </tr>
          ) : null}
          {aircraft.aircraftType ? (
            <tr>
              <td className="pr-2 text-slate-400">Type</td>
              <td>{aircraft.aircraftType}</td>
            </tr>
          ) : null}
          {aircraft.operator ? (
            <tr>
              <td className="pr-2 text-slate-400">Operator</td>
              <td>{aircraft.operator}</td>
            </tr>
          ) : null}
          {(aircraft.countryCode || aircraft.countryFlagUrl) ? (
            <tr>
              <td className="pr-2 text-slate-400">Country</td>
              <td>
                <div className="flex items-center gap-2">
                  <CountryBadge countryCode={aircraft.countryCode} countryFlagUrl={aircraft.countryFlagUrl} />
                  <span>{aircraft.countryCode ?? "-"}</span>
                </div>
              </td>
            </tr>
          ) : null}
          {aircraft.isMilitary ? (
            <tr>
              <td className="pr-2 text-slate-400">Class</td>
              <td>
                <MilitaryBadge />
              </td>
            </tr>
          ) : null}
          <tr>
            <td className="pr-2 text-slate-400">ICAO</td>
            <td className="font-mono">{aircraft.icao.toUpperCase()}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">Altitude</td>
            <td>{formatAlt(aircraft.altitude)}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">Speed</td>
            <td>{formatSpeed(aircraft.speed)}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">Heading</td>
            <td>{formatHeading(aircraft.heading)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 border-t border-slate-700 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Flight Trail
        </div>

        <div className="flex items-center gap-2">
          <input
            aria-label="Trail hours"
            className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
            max={TRAIL_MAX_HOURS}
            min={1}
            onChange={(event) => setCustomHours(event.target.value)}
            placeholder="hours"
            type="number"
            value={customHours}
          />
          <span className="text-xs text-slate-400">max {TRAIL_MAX_HOURS}h</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {trailActive ? (
            <button
              className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-100 hover:border-slate-400"
              onClick={onClearTrail}
              type="button"
            >
              Clear Trail ({trailCount} pts)
            </button>
          ) : (
            <button
              className="rounded border border-sky-500 px-3 py-1 text-xs text-sky-100 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isTrailLoading || parsedHours < 1}
              onClick={() => onLoadTrail(parsedHours)}
              type="button"
            >
              {isTrailLoading ? "Loading..." : `Show Trail (${parsedHours}h)`}
            </button>
          )}
        </div>
        {trailError ? <p className="mt-2 text-xs text-rose-300">{trailError}</p> : null}
      </div>

      <div className="mt-3 border-t border-slate-700 pt-3">
        <AddToWatchlistDropdown icao={aircraft.icao} />
      </div>

      <div className="mt-2">
        <button
          className="w-full rounded border border-cyan-500 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/10"
          onClick={onShowDetails}
          type="button"
        >
          View Details
        </button>
      </div>
    </div>
  );
}

export function AircraftPopup(): JSX.Element {
  const { map, mapContainerEl } = useMapContext();
  const popupRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const showDetails = useAircraftStore((state) => state.showDetails);
  const clearTrail = useAircraftStore((state) => state.clearTrail);
  const selectedIcao = useAircraftStore((state) => state.selectedIcao);
  const trailIcao = useAircraftStore((state) => state.trailIcao);
  const trailCount = useAircraftStore((state) => state.trailPositions.length);
  const aircraft = useAircraftStore((state) => (selectedIcao ? state.aircraft[selectedIcao] : null));
  const { isLoading, error, loadTrail } = useFlightHistory();

  const handleClose = (): void => {
    selectAircraft(null);
  };

  const handleShowDetails = (): void => {
    if (aircraft) {
      showDetails(aircraft.icao);
    }
  };

  useLayoutEffect(() => {
    const connectorEl = connectorRef.current;
    if (!connectorEl) {
      return;
    }

    if (!map || !mapContainerEl || !popupRef.current || !aircraft) {
      connectorEl.style.display = "none";
      return;
    }

    const updateLine = (): void => {
      if (!popupRef.current || !mapContainerEl || !connectorRef.current) {
        return;
      }

      const popupRect = popupRef.current.getBoundingClientRect();
      const mapRect = mapContainerEl.getBoundingClientRect();
      const pixel = map.getPixelFromCoordinate(fromLonLat([aircraft.lon, aircraft.lat]));
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
  }, [aircraft, map, mapContainerEl]);

  const handleLoadTrail = (hoursBack: number): void => {
    if (!aircraft) {
      return;
    }
    void loadTrail(aircraft.icao, hoursBack);
  };

  const isVisible = Boolean(aircraft && mapContainerEl);
  const isTrailActive = trailIcao === aircraft?.icao && trailCount > 0;

  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[19]"
        data-testid="aircraft-popup-connector"
      >
        <line
          ref={connectorRef}
          opacity="0.7"
          stroke="#38bdf8"
          strokeDasharray="6 4"
          strokeWidth="1.5"
          style={{ display: "none" }}
        />
      </svg>
      <div
        className="pointer-events-none absolute inset-0 z-20"
        data-testid="aircraft-popup"
      >
        {isVisible && aircraft ? (
          <div
            ref={popupRef}
            className="pointer-events-auto absolute left-3 top-12 max-h-[calc(100%-60px)] overflow-y-auto"
          >
            <PopupContent
              aircraft={aircraft}
              isTrailLoading={isLoading}
              onClearTrail={clearTrail}
              onClose={handleClose}
              onLoadTrail={handleLoadTrail}
              onShowDetails={handleShowDetails}
              trailActive={isTrailActive}
              trailCount={trailCount}
              trailError={error}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
