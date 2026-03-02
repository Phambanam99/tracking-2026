import { useState } from "react";
import { useWatchlistStore } from "../store/useWatchlistStore";
import { CreateGroupInline } from "./CreateGroupInline";
import { WatchlistGroupCard } from "./WatchlistGroupCard";

type WatchlistPanelProps = {
  onClose: () => void;
};

export function WatchlistPanel({ onClose }: WatchlistPanelProps): JSX.Element {
  const groups = useWatchlistStore((state) => state.groups);
  const isLoading = useWatchlistStore((state) => state.loading);
  const error = useWatchlistStore((state) => state.error);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div
      aria-label="Watchlist panel"
      className="absolute bottom-0 right-0 top-0 z-30 flex w-72 flex-col border-l border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-sm"
    >
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Watchlist</h2>
          <p className="text-[10px] text-slate-400">Track aircraft groups on the map</p>
        </div>
        <div className="flex items-center gap-1">
          {/* New group button */}
          <button
            aria-label="Create new group"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-cyan-300"
            onClick={() => setShowCreate((v) => !v)}
            title="New group"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Close button */}
          <button
            aria-label="Close watchlist"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Inline create form */}
        {showCreate && (
          <div className="mb-3">
            <CreateGroupInline onDone={() => setShowCreate(false)} />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <p className="text-center text-xs text-slate-500">Loading…</p>
        )}

        {/* Error */}
        {!isLoading && error && (
          <p className="rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* Empty state */}
        {!isLoading && !error && groups.length === 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">No groups yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Click <span className="text-slate-300">+</span> to create your first watchlist group.
            </p>
          </div>
        )}

        {/* Group cards */}
        {groups.length > 0 && (
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <WatchlistGroupCard group={group} key={group.id} />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {groups.length > 0 && (
        <div className="shrink-0 border-t border-slate-700 px-4 py-2">
          <p className="text-[10px] text-slate-500">
            {groups.length} group{groups.length !== 1 ? "s" : ""} ·{" "}
            {groups.reduce((sum, g) => sum + (g.entries?.length ?? g.entryCount), 0)} aircraft
          </p>
        </div>
      )}
    </div>
  );
}
