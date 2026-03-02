import { useState } from "react";
import { useWatchlistStore } from "../store/useWatchlistStore";
import type { WatchlistEntry } from "../types/watchlistTypes";

type WatchlistAircraftRowProps = {
  groupId: number;
  entry: WatchlistEntry;
};

export function WatchlistAircraftRow({
  groupId,
  entry,
}: WatchlistAircraftRowProps): JSX.Element {
  const removeAircraft = useWatchlistStore((state) => state.removeAircraft);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeAircraft(groupId, entry.icao);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-slate-700/50">
      <div className="min-w-0 flex-1">
        <span className="font-mono text-xs text-cyan-300">{entry.icao.toUpperCase()}</span>
        {entry.note && (
          <span className="ml-2 truncate text-xs text-slate-400">{entry.note}</span>
        )}
      </div>

      <button
        aria-label={`Remove ${entry.icao} from watchlist`}
        className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-600 hover:text-red-400 disabled:opacity-40"
        disabled={removing}
        onClick={() => void handleRemove()}
        title="Remove"
        type="button"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
