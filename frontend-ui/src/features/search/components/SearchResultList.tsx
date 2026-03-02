import { useAircraftStore } from "../../aircraft/store/useAircraftStore";
import { useSearchStore } from "../store/useSearchStore";
import type { SearchResult } from "../types/searchTypes";

type SearchResultListProps = {
  results: SearchResult[];
};

export function SearchResultList({ results }: SearchResultListProps): JSX.Element {
  const selectAircraft = useAircraftStore((s) => s.selectAircraft);
  const selectResult = useSearchStore((s) => s.selectResult);
  const selectedIcao = useSearchStore((s) => s.selectedIcao);

  function handleClick(icao: string) {
    selectResult(icao);
    selectAircraft(icao);
  }

  if (results.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-slate-500">
        No aircraft found. Try a different query.
      </p>
    );
  }

  return (
    <ul aria-label="Search results" className="flex flex-col divide-y divide-slate-700/50">
      {results.map((r) => (
        <li key={r.icao}>
          <button
            className={`w-full px-4 py-2.5 text-left hover:bg-slate-700/60 ${
              selectedIcao === r.icao ? "bg-slate-700/80" : ""
            }`}
            onClick={() => handleClick(r.icao)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-cyan-300">
                {r.icao.toUpperCase()}
              </span>
              {r.aircraftType && (
                <span className="text-[10px] text-slate-400">{r.aircraftType}</span>
              )}
            </div>

            {(r.callsign ?? r.registration ?? r.operator) && (
              <div className="mt-0.5 flex gap-2 text-[11px] text-slate-300">
                {r.callsign && <span>{r.callsign}</span>}
                {r.registration && <span className="text-slate-400">{r.registration}</span>}
                {r.operator && (
                  <span className="truncate text-slate-500">{r.operator}</span>
                )}
              </div>
            )}

            <div className="mt-0.5 flex gap-3 text-[10px] text-slate-500">
              {r.altitude != null && <span>{r.altitude.toLocaleString()} ft</span>}
              {r.speed != null && <span>{Math.round(r.speed)} kts</span>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
