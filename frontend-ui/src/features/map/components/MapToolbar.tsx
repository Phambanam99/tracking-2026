import type { BaseLayerType } from "../layers/baseLayer";

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
  /** Active base layer so the toolbar can expose the foundation map switcher. */
  baseLayerType?: BaseLayerType;
  /** Callback for switching between available base layers. */
  onBaseLayerChange?: (type: BaseLayerType) => void;
};

export function MapToolbar({
  trackedCount,
  baseLayerType = "osm",
  onBaseLayerChange,
}: MapToolbarProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/95 px-3 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-200">Live Map</span>
        <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 p-1">
          <BaseLayerButton
            isActive={baseLayerType === "osm"}
            label="OSM"
            onClick={() => onBaseLayerChange?.("osm")}
          />
          <BaseLayerButton
            isActive={baseLayerType === "satellite"}
            label="Satellite"
            onClick={() => onBaseLayerChange?.("satellite")}
          />
        </div>
      </div>
      {trackedCount != null && (
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          {trackedCount} tracked
        </span>
      )}
    </div>
  );
}

type BaseLayerButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function BaseLayerButton({ label, isActive, onClick }: BaseLayerButtonProps): JSX.Element {
  return (
    <button
      aria-pressed={isActive}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        isActive
          ? "bg-sky-400 text-slate-950"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
