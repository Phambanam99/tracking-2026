import { useState } from "react";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useWatchlistStore } from "../store/useWatchlistStore";
import type { WatchlistGroup } from "../types/watchlistTypes";

const DEFAULT_GROUP_COLOR = "#3b82f6";
const DEFAULT_GROUP_NAME = "Default";

type AddToWatchlistDropdownProps = {
  icao: string;
};

export function AddToWatchlistDropdown({ icao }: AddToWatchlistDropdownProps): JSX.Element | null {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const groups: WatchlistGroup[] = useWatchlistStore((state) => state.groups);
  const addAircraft = useWatchlistStore((state) => state.addAircraft);
  const createGroup = useWatchlistStore((state) => state.createGroup);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return null;
  }

  const normalizedIcao = icao.toLowerCase();
  const inGroupIds = new Set(
    groups
      .filter((group) => group.entries?.some((entry) => entry.icao.toLowerCase() === normalizedIcao))
      .map((group) => group.id),
  );

  async function handleAdd(groupId: number): Promise<void> {
    if (inGroupIds.has(groupId)) {
      return;
    }

    setAdding(groupId);
    setError(null);
    setMessage(null);

    try {
      await addAircraft(groupId, normalizedIcao);
      const group = groups.find((candidate) => candidate.id === groupId);
      setDone(groupId);
      setMessage(group ? `Added to ${group.name}` : "Added to watchlist");
      window.setTimeout(() => setDone(null), 2000);
      window.setTimeout(() => setMessage(null), 2000);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add aircraft");
    } finally {
      setAdding(null);
    }
  }

  async function handleAddToDefault(): Promise<void> {
    setAdding(-1);
    setError(null);
    setMessage(null);

    try {
      const defaultGroup = await createGroup(DEFAULT_GROUP_NAME, DEFAULT_GROUP_COLOR);
      await addAircraft(defaultGroup.id, normalizedIcao);
      setDone(defaultGroup.id);
      setMessage(`Added to ${DEFAULT_GROUP_NAME} group`);
      window.setTimeout(() => setDone(null), 2000);
      window.setTimeout(() => setMessage(null), 2000);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add aircraft");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="relative mt-2">
      <button
        className="w-full rounded border border-slate-500 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? "Hide Watchlist" : "Add to Watchlist"}
      </button>

      {message ? <p className="mt-1 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-slate-600 bg-slate-800 shadow-xl">
          {groups.length === 0 ? (
            <div className="px-3 py-3">
              <p className="mb-2 text-xs text-slate-400">
                No groups yet. Create a default group and add this aircraft immediately.
              </p>
              <button
                className="w-full rounded border border-sky-500 px-2 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={adding === -1}
                onClick={() => void handleAddToDefault()}
                type="button"
              >
                {adding === -1 ? "Adding..." : "Add to Default group"}
              </button>
            </div>
          ) : (
            groups.map((group) => {
              const alreadyIn = inGroupIds.has(group.id);
              const isDone = done === group.id;
              const isAdding = adding === group.id;

              return (
                <button
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-700 ${
                    alreadyIn ? "cursor-default opacity-50" : ""
                  }`}
                  disabled={alreadyIn || isAdding}
                  key={group.id}
                  onClick={() => void handleAdd(group.id)}
                  type="button"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="flex-1 truncate text-slate-100">{group.name}</span>
                  {alreadyIn ? <span className="text-slate-500">Added</span> : null}
                  {isDone ? <span className="text-green-400">Added!</span> : null}
                  {isAdding ? <span className="text-slate-400">...</span> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
