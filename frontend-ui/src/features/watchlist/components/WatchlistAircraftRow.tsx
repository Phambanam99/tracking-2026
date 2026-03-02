import { useMemo, useState } from "react";
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
  const groups = useWatchlistStore((state) => state.groups);
  const addAircraft = useWatchlistStore((state) => state.addAircraft);
  const removeAircraft = useWatchlistStore((state) => state.removeAircraft);
  const [removing, setRemoving] = useState(false);
  const [movingToGroupId, setMovingToGroupId] = useState<number | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveTargets = useMemo(
    () =>
      groups.filter((group) => {
        if (group.id === groupId) {
          return false;
        }

        return !group.entries?.some(
          (candidate) => candidate.icao.toLowerCase() === entry.icao.toLowerCase(),
        );
      }),
    [entry.icao, groupId, groups],
  );

  async function handleRemove(): Promise<void> {
    setRemoving(true);
    setError(null);

    try {
      await removeAircraft(groupId, entry.icao);
    } finally {
      setRemoving(false);
    }
  }

  async function handleMove(targetGroupId: number): Promise<void> {
    setMovingToGroupId(targetGroupId);
    setError(null);

    try {
      // Add first, then remove, so a failed move does not drop the aircraft.
      await addAircraft(targetGroupId, entry.icao, entry.note ?? undefined);
      await removeAircraft(groupId, entry.icao);
      setMoveMenuOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move aircraft");
    } finally {
      setMovingToGroupId(null);
    }
  }

  return (
    <div className="rounded px-2 py-1.5 hover:bg-slate-700/50">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-xs text-cyan-300">{entry.icao.toUpperCase()}</span>
          {entry.note ? (
            <span className="ml-2 truncate text-xs text-slate-400">{entry.note}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {moveTargets.length > 0 ? (
            <div className="relative">
              <button
                aria-expanded={moveMenuOpen}
                aria-label={`Move ${entry.icao} to another group`}
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-600 hover:text-sky-300 disabled:opacity-40"
                disabled={movingToGroupId !== null || removing}
                onClick={() => setMoveMenuOpen((value) => !value)}
                title="Move to"
                type="button"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h12M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {moveMenuOpen ? (
                <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-slate-600 bg-slate-800 shadow-xl">
                  {moveTargets.map((group) => {
                    const isMoving = movingToGroupId === group.id;
                    return (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={movingToGroupId !== null}
                        key={group.id}
                        onClick={() => void handleMove(group.id)}
                        type="button"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="flex-1 truncate">{group.name}</span>
                        {isMoving ? <span className="text-slate-400">Moving...</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            aria-label={`Remove ${entry.icao} from watchlist`}
            className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-600 hover:text-red-400 disabled:opacity-40"
            disabled={removing || movingToGroupId !== null}
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
      </div>

      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
