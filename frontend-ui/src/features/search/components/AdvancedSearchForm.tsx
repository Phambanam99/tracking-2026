import { useSearchStore } from "../store/useSearchStore";
import { searchHistory } from "../api/searchApi";

/** Minimal advanced filter form — only shown in "history" mode */
export function AdvancedSearchForm(): JSX.Element {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const setResults = useSearchStore((s) => s.setResults);
  const setSearching = useSearchStore((s) => s.setSearching);
  const setError = useSearchStore((s) => s.setError);
  const isSearching = useSearchStore((s) => s.isSearching);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    const { mode: _mode, ...historyFilters } = filters;
    searchHistory(historyFilters)
      .then((resp) => {
        setResults(resp.results);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "History search failed");
      })
      .finally(() => {
        setSearching(false);
      });
  }

  return (
    <form className="grid grid-cols-2 gap-2 px-4 pb-3" onSubmit={handleSubmit}>
      <div className="col-span-2">
        <label className="block text-[10px] text-slate-400">ICAO Hex</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          onChange={(e) => setFilters({ icao: e.target.value || undefined })}
          placeholder="e.g. abc123"
          type="text"
          value={filters.icao ?? ""}
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400">Callsign</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          onChange={(e) => setFilters({ callsign: e.target.value || undefined })}
          placeholder="e.g. VN123"
          type="text"
          value={filters.callsign ?? ""}
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400">Aircraft Type</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          onChange={(e) => setFilters({ aircraftType: e.target.value || undefined })}
          placeholder="e.g. A321"
          type="text"
          value={filters.aircraftType ?? ""}
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400">From (UTC)</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          onChange={(e) => setFilters({ timeFrom: e.target.value || undefined })}
          type="datetime-local"
          value={filters.timeFrom ?? ""}
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400">To (UTC)</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          onChange={(e) => setFilters({ timeTo: e.target.value || undefined })}
          type="datetime-local"
          value={filters.timeTo ?? ""}
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400">Alt min (ft)</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          min={0}
          onChange={(e) =>
            setFilters({ altitudeMin: e.target.value ? Number(e.target.value) : undefined })
          }
          type="number"
          value={filters.altitudeMin ?? ""}
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400">Alt max (ft)</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          min={0}
          onChange={(e) =>
            setFilters({ altitudeMax: e.target.value ? Number(e.target.value) : undefined })
          }
          type="number"
          value={filters.altitudeMax ?? ""}
        />
      </div>

      <div className="col-span-2 mt-1">
        <button
          className="w-full rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          disabled={isSearching}
          type="submit"
        >
          {isSearching ? "Searching…" : "Search History"}
        </button>
      </div>
    </form>
  );
}
