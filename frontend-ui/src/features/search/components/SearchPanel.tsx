import { useSearchStore } from "../store/useSearchStore";
import { useSearchAircraft } from "../hooks/useSearchAircraft";
import { AdvancedSearchForm } from "./AdvancedSearchForm";
import { SearchBar } from "./SearchBar";
import { SearchResultList } from "./SearchResultList";

type SearchPanelProps = {
  onClose: () => void;
};

export function SearchPanel({ onClose }: SearchPanelProps): JSX.Element {
  // Drive viewport search on every aircraft/query change.
  useSearchAircraft();

  const results = useSearchStore((s) => s.results);
  const isSearching = useSearchStore((s) => s.isSearching);
  const error = useSearchStore((s) => s.error);
  const mode = useSearchStore((s) => s.filters.mode);
  const query = useSearchStore((s) => s.filters.query);

  return (
    <div
      aria-label="Search panel"
      className="absolute bottom-0 left-0 top-0 z-30 flex w-72 flex-col border-r border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Search</h2>
          <p className="text-[10px] text-slate-400">Find aircraft on the map</p>
        </div>
        <button
          aria-label="Close search"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Search Bar */}
      <SearchBar />

      {/* Advanced form for history mode */}
      {mode === "history" && <AdvancedSearchForm />}

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isSearching && (
          <p className="px-4 py-4 text-center text-xs text-slate-500">Searching…</p>
        )}

        {/* Error */}
        {!isSearching && error && (
          <div className="mx-3 mt-2 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {!isSearching && !error && (
          <>
            {query.length >= 2 && (
              <div className="border-b border-slate-700/50 px-4 py-1.5">
                <span className="text-[10px] text-slate-500">
                  {results.length === 0
                    ? "No results"
                    : `${results.length} result${results.length !== 1 ? "s" : ""}${results.length === 50 ? " (showing first 50)" : ""}`}
                </span>
              </div>
            )}
            <SearchResultList results={results} />
          </>
        )}

        {/* Initial state */}
        {!isSearching && !error && query.length < 2 && mode === "viewport" && (
          <div className="mt-8 px-4 text-center">
            <p className="text-xs text-slate-500">
              Search aircraft currently visible on the map by ICAO, callsign, registration, or type.
            </p>
          </div>
        )}

        {/* Global/History not available yet */}
        {!isSearching && query.length >= 2 && mode !== "viewport" && results.length === 0 && !error && (
          <div className="mx-3 mt-3 rounded border border-amber-800/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-400">
            {mode === "global"
              ? "Global search requires service-query to be running. Available in next release."
              : "History search requires service-query. Available in next release."}
          </div>
        )}
      </div>
    </div>
  );
}
