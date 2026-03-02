/**
 * MapToolbar – top bar inside the map viewport.
 *
 * Placeholder for Phase 2+ drawing / layer toggle buttons.
 * Currently only shows the page title and flight count (passed as a prop for
 * flexibility, since the aircraft layer populates it).
 */
export type MapToolbarProps = {
  /** Optional flight / vessel count to display in the toolbar. */
  trackedCount?: number;
};

export function MapToolbar({ trackedCount }: MapToolbarProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/95 px-3 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-200">Live Map</span>
        {/* TODO Phase 2: Draw / Measure / Layer buttons */}
      </div>
      {trackedCount != null && (
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          {trackedCount} tracked
        </span>
      )}
    </div>
  );
}
