import { useState } from "react";
import { useLayerStore, type LayerId } from "../store/useLayerStore";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";

const LAYERS: Array<{ id: LayerId; label: string; swatchClassName: string }> = [
  { id: "live", label: "Live Aircraft", swatchClassName: "bg-emerald-400" },
  { id: "watchlist", label: "Watchlist Overlay", swatchClassName: "bg-sky-400" },
  { id: "military", label: "Military Aircraft", swatchClassName: "bg-red-500" },
  { id: "trail", label: "History Trail", swatchClassName: "bg-cyan-300" },
];

export function LayerPanel(): JSX.Element {
  const visible = useLayerStore((state) => state.visible);
  const aircraftFilter = useLayerStore((state) => state.aircraftFilter);
  const toggle = useLayerStore((state) => state.toggle);
  const setAircraftFilter = useLayerStore((state) => state.setAircraftFilter);
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 left-4 z-30">
      <button
        aria-expanded={open}
        aria-label="Toggle layer panel"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur hover:border-slate-400"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M12 4 4 8l8 4 8-4-8-4Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m4 12 8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m4 16 8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <section className="mt-3 w-72 rounded-xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-100">Layers</h2>
            <p className="text-xs text-slate-400">Control what the map renders while you pan.</p>
          </div>

          <div className="space-y-2">
            {LAYERS.map((layer) => (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2" key={layer.id}>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    checked={visible[layer.id]}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                    onChange={() => toggle(layer.id)}
                    type="checkbox"
                  />
                  <span className={`h-2.5 w-2.5 rounded-full ${layer.swatchClassName}`} />
                  <span className="flex-1 text-sm text-slate-100">{layer.label}</span>
                </label>

                {layer.id === "live" ? (
                  <>
                    <div className="mt-3 flex gap-2">
                      <button
                        aria-pressed={aircraftFilter === "all"}
                        className={`rounded-full px-3 py-1 text-xs ${
                          aircraftFilter === "all"
                            ? "bg-sky-500 text-slate-950"
                            : "border border-slate-700 text-slate-300"
                        }`}
                        onClick={() => setAircraftFilter("all")}
                        type="button"
                      >
                        All aircraft
                      </button>
                      <button
                        aria-pressed={aircraftFilter === "watchlist"}
                        className={`rounded-full px-3 py-1 text-xs ${
                          aircraftFilter === "watchlist"
                            ? "bg-sky-500 text-slate-950"
                            : "border border-slate-700 text-slate-300"
                        }`}
                        onClick={() => setAircraftFilter("watchlist")}
                        type="button"
                      >
                        Watchlist only
                      </button>
                    </div>
                    {aircraftFilter === "watchlist" ? <WatchlistGroupFilter /> : null}
                  </>
                ) : null}

                {layer.id === "watchlist" && visible.watchlist ? <WatchlistGroupFilter /> : null}
                {layer.id === "military" ? (
                  <div className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 px-2 py-2 text-[11px] text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span className="h-2.5 w-2.5 rounded-full border border-amber-300 bg-transparent" />
                      <span>When enabled, only active backend-tagged military aircraft stay on the map.</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function WatchlistGroupFilter(): JSX.Element {
  const groups = useWatchlistStore((state) => state.groups);
  const toggleGroupVisibility = useWatchlistStore((state) => state.toggleGroupVisibility);

  if (groups.length === 0) {
    return <p className="mt-2 text-xs italic text-slate-500">No watchlist groups yet</p>;
  }

  return (
    <div className="mt-3 space-y-1 border-t border-slate-800 pt-2">
      {groups.map((group) => (
        <label className="flex cursor-pointer items-center gap-2" key={group.id}>
          <input
            checked={group.visibleOnMap}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
            onChange={() => toggleGroupVisibility(group.id)}
            type="checkbox"
          />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
          <span className="text-xs text-slate-300">{group.name}</span>
          <span className="ml-auto text-[10px] text-slate-500">
            {group.entryCount ?? group.entries?.length ?? 0}
          </span>
        </label>
      ))}
    </div>
  );
}
