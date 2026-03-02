import { useState } from "react";
import { useWatchlistStore } from "../store/useWatchlistStore";
import type { WatchlistGroup } from "../types/watchlistTypes";
import { WatchlistAircraftRow } from "./WatchlistAircraftRow";

type WatchlistGroupCardProps = {
  group: WatchlistGroup;
};

export function WatchlistGroupCard({ group }: WatchlistGroupCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toggleGroupVisibility = useWatchlistStore((state) => state.toggleGroupVisibility);
  const deleteGroup = useWatchlistStore((state) => state.deleteGroup);

  async function handleDelete() {
    if (!confirm(`Delete group "${group.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteGroup(group.id);
    } finally {
      setDeleting(false);
    }
  }

  const entryCount = group.entries?.length ?? group.entryCount;

  return (
    <div className="rounded-md border border-slate-600 bg-slate-700/50">
      {/* Group header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Color dot */}
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-slate-500"
          style={{ backgroundColor: group.color }}
          title="Group color"
        />

        {/* Name + count — expands sub-list */}
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          <span className="truncate text-xs font-medium text-slate-100">{group.name}</span>
          <span className="shrink-0 rounded bg-slate-600 px-1 py-0.5 text-[10px] text-slate-300">
            {entryCount}
          </span>
          <svg
            className={`ml-auto h-3 w-3 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Eye (visibility) toggle */}
        <button
          aria-label={group.visibleOnMap ? "Hide on map" : "Show on map"}
          className={`shrink-0 rounded p-1 ${
            group.visibleOnMap
              ? "text-cyan-400 hover:bg-slate-600"
              : "text-slate-500 hover:bg-slate-600 hover:text-slate-300"
          }`}
          onClick={() => toggleGroupVisibility(group.id)}
          type="button"
        >
          {group.visibleOnMap ? (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Delete */}
        <button
          aria-label={`Delete group ${group.name}`}
          className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-600 hover:text-red-400 disabled:opacity-40"
          disabled={deleting}
          onClick={() => void handleDelete()}
          type="button"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Expanded aircraft list */}
      {expanded && (
        <div className="border-t border-slate-600 px-1 py-1">
          {entryCount === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-500">No aircraft tracked yet.</p>
          ) : (
            (group.entries ?? []).map((entry) => (
              <WatchlistAircraftRow entry={entry} groupId={group.id} key={entry.icao} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
