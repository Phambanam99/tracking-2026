import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fromLonLat } from "ol/proj";
import { useMapContext } from "../../map/context/MapContext";
import { useFlightHistory } from "../hooks/useFlightHistory";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";
import { AddToWatchlistDropdown } from "../../watchlist/components/AddToWatchlistDropdown";

/** Returns a flag emoji for a given ISO 3166-1 alpha-2 country code. */
function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 0x1f1e6;
  const chars = code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(offset + c.charCodeAt(0) - 65));
  return chars.join("");
}

function formatAlt(ft: number | null | undefined): string {
  if (ft == null) return "–";
  if (ft <= 0) return "Ground";
  return `${ft.toLocaleString()} ft`;
}

function formatSpeed(kts: number | null | undefined): string {
  if (kts == null) return "–";
  return `${Math.round(kts)} kts`;
}

function formatHeading(deg: number | null | undefined): string {
  if (deg == null) return "–";
  return `${Math.round(deg)}°`;
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

const TRAIL_PRESETS = [1, 3, 6, 12, 24] as const;
const TRAIL_MAX_HOURS = 168; // 7 days

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
  const flag = countryFlag(aircraft.countryCode);
  const [customHours, setCustomHours] = useState<string>("1");

  const parsedHours = Math.min(TRAIL_MAX_HOURS, Math.max(1, Math.round(Number(customHours) || 1)));

  return (
    <div className="relative min-w-[220px] rounded-lg border border-slate-600 bg-slate-800 p-3 text-sm text-slate-100 shadow-xl">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-2 top-2 text-slate-400 hover:text-white"
        aria-label="Close popup"
      >
        ✕
      </button>

      {/* Header */}
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className="text-lg">{flag}</span>
        <span>{aircraft.callsign ?? aircraft.registration ?? aircraft.icao}</span>
      </div>

      {/* Detail rows */}
      <table className="w-full text-xs">
        <tbody>
          {aircraft.registration && (
            <tr>
              <td className="pr-2 text-slate-400">Reg</td>
              <td>{aircraft.registration}</td>
            </tr>
          )}
          {aircraft.aircraftType && (
            <tr>
              <td className="pr-2 text-slate-400">Type</td>
              <td>{aircraft.aircraftType}</td>
            </tr>
          )}
          {aircraft.operator && (
            <tr>
              <td className="pr-2 text-slate-400">Operator</td>
              <td>{aircraft.operator}</td>
            </tr>
          )}
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

        {/* Quick preset buttons */}
        <div className="flex flex-wrap gap-1">
          {TRAIL_PRESETS.map((h) => (
            <button
              key={h}
              className={`rounded border px-2 py-1 text-xs ${
                parsedHours === h && customHours === String(h)
                  ? "border-sky-400 bg-sky-500/20 text-sky-100"
                  : "border-slate-600 text-slate-300 hover:border-slate-400"
              }`}
              onClick={() => setCustomHours(String(h))}
              type="button"
            >
              {h}h
            </button>
          ))}
        </div>

        {/* Custom hours input */}
        <div className="mt-2 flex items-center gap-2">
          <input
            aria-label="Custom trail hours"
            className="w-16 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
            max={TRAIL_MAX_HOURS}
            min={1}
            onChange={(e) => setCustomHours(e.target.value)}
            placeholder="hrs"
            type="number"
            value={customHours}
          />
          <span className="text-xs text-slate-400">hours (max {TRAIL_MAX_HOURS}h)</span>
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

      {/* Add to Watchlist */}
      <div className="mt-3 border-t border-slate-700 pt-3">
        <AddToWatchlistDropdown icao={aircraft.icao} />
      </div>

      {/* View Details button */}
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

/**
 * Renders a floating popup for the currently selected aircraft using an OL
 * Overlay. Must be rendered inside MapContainer (needs MapContext).
 *
 * The popup element is mounted into a dedicated DOM node that is positioned
 * over the map canvas via the OL Overlay API.
 */
export function AircraftPopup(): JSX.Element {
  const { map, mapContainerEl } = useMapContext();
  const popupRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const selectAircraft = useAircraftStore((s) => s.selectAircraft);
  const showDetails = useAircraftStore((s) => s.showDetails);
  const clearTrail = useAircraftStore((s) => s.clearTrail);
  const selectedIcao = useAircraftStore((s) => s.selectedIcao);
  const trailIcao = useAircraftStore((s) => s.trailIcao);
  const trailCount = useAircraftStore((s) => s.trailPositions.length);
  const aircraft = useAircraftStore((s) =>
    selectedIcao ? s.aircraft[selectedIcao] : null,
  );
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
