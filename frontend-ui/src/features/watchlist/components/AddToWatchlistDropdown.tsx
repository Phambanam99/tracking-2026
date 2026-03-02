import { useState } from "react";
import { useWatchlistStore } from "../store/useWatchlistStore";
import { useAuthStore } from "../../auth/store/useAuthStore";
import type { WatchlistGroup } from "../types/watchlistTypes";

type AddToWatchlistDropdownProps = {
  icao: string;
};

export function AddToWatchlistDropdown({ icao }: AddToWatchlistDropdownProps): JSX.Element | null {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const groups: WatchlistGroup[] = useWatchlistStore((state) => state.groups);
  const addAircraft = useWatchlistStore((state) => state.addAircraft);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);

  if (!isAuthenticated) return null;

  // Check which groups already contain this ICAO
  const inGroupIds = new Set(
    groups
      .filter((g) => g.entries?.some((e) => e.icao.toLowerCase() === icao.toLowerCase()))
      .map((g) => g.id),
  );

  async function handleAdd(groupId: number) {
    if (inGroupIds.has(groupId)) return;
    setAdding(groupId);
    try {
      await addAircraft(groupId, icao.toLowerCase());
      setDone(groupId);
      setTimeout(() => setDone(null), 2000);
    } finally {
      setAdding(null);
    }
    setOpen(false);
  }

  return (
    <div className="relative mt-2">
      <button
        className="w-full rounded border border-slate-500 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? "▲ Watchlist" : "▼ Add to Watchlist"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-slate-600 bg-slate-800 shadow-xl">
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              No groups yet — open the Watchlist panel to create one.
            </p>
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
                  {alreadyIn && <span className="text-slate-500">✓</span>}
                  {isDone && <span className="text-green-400">Added!</span>}
                  {isAdding && <span className="text-slate-400">…</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
