import { useState } from "react";
import { IconButton } from "../../../shared/components/IconButton";
import { OverlayPanel } from "../../../shared/components/OverlayPanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";
import { useLayerStore, type LayerId } from "../store/useLayerStore";

const LAYERS: Array<{ id: LayerId; labelKey: string; swatchClassName: string; descriptionKey: string }> = [
  {
    id: "live",
    labelKey: "layers.liveAircraft",
    swatchClassName: "bg-emerald-400",
    descriptionKey: "layers.liveAircraftDescription",
  },
  {
    id: "watchlist",
    labelKey: "layers.watchlistOverlay",
    swatchClassName: "bg-sky-400",
    descriptionKey: "layers.watchlistOverlayDescription",
  },
  {
    id: "military",
    labelKey: "layers.militaryAircraft",
    swatchClassName: "bg-red-500",
    descriptionKey: "layers.militaryAircraftDescription",
  },
  {
    id: "trail",
    labelKey: "layers.historyTrail",
    swatchClassName: "bg-cyan-300",
    descriptionKey: "layers.historyTrailDescription",
  },
];

type LayerPanelProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  dockClassName?: string;
  animationClassName?: string;
  widthClassName?: string;
  enableSwipeClose?: boolean;
  className?: string;
};

export function LayerPanel({
  open,
  onOpenChange,
  showTrigger = true,
  dockClassName,
  animationClassName,
  widthClassName,
  enableSwipeClose = false,
  className,
}: LayerPanelProps): JSX.Element {
  const { t } = useI18n();
  const visible = useLayerStore((state) => state.visible);
  const aircraftFilter = useLayerStore((state) => state.aircraftFilter);
  const toggle = useLayerStore((state) => state.toggle);
  const setAircraftFilter = useLayerStore((state) => state.setAircraftFilter);
  const [internalOpen, setInternalOpen] = useState(false);
  const resolvedOpen = open ?? internalOpen;

  function setOpen(nextOpen: boolean): void {
    onOpenChange?.(nextOpen);
    if (open == null) {
      setInternalOpen(nextOpen);
    }
  }

  return (
    <div className={className ?? "absolute bottom-4 right-4 z-30"}>
      {showTrigger ? (
        <IconButton
          active={resolvedOpen}
          ariaLabel="Toggle layer panel"
          className="glass-panel text-slate-100 hover:border-slate-400"
          onClick={() => setOpen(!resolvedOpen)}
          tooltip={t("toolbar.layers")}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M12 4 4 8l8 4 8-4-8-4Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m4 12 8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m4 16 8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      ) : null}

      {resolvedOpen ? (
        <OverlayPanel
          ariaLabel="Layer panel"
          animationClassName={animationClassName}
          closeLabel={t("layers.close")}
          description={t("layers.description")}
          dockClassName={
            dockClassName ?? `right-0 top-auto h-auto max-h-[70vh] ${showTrigger ? "bottom-16" : "bottom-24"}`
          }
          enableSwipeClose={enableSwipeClose}
          onClose={() => setOpen(false)}
          title={t("layers.title")}
          widthClassName={widthClassName ?? "w-80"}
        >
          <div className="space-y-4 p-4">
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
              <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">{t("layers.visibility")}</p>
              <div className="space-y-2">
                {LAYERS.map((layer) => (
                  <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3" key={layer.id}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        aria-label={t(layer.labelKey)}
                        checked={visible[layer.id]}
                        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                        onChange={() => toggle(layer.id)}
                        type="checkbox"
                      />
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${layer.swatchClassName}`} />
                      <span className="flex-1">
                        <span className="block text-sm text-slate-100">{t(layer.labelKey)}</span>
                        <span className="mt-1 block text-[11px] text-slate-500">{t(layer.descriptionKey)}</span>
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
              <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">{t("layers.liveFilter")}</p>
              <div className="flex gap-2">
                <button
                  aria-pressed={aircraftFilter === "all"}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-xs transition ${
                    aircraftFilter === "all"
                      ? "bg-sky-500 text-slate-950"
                      : "border border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                  onClick={() => setAircraftFilter("all")}
                  type="button"
                >
                  {t("layers.allAircraft")}
                </button>
                <button
                  aria-pressed={aircraftFilter === "watchlist"}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-xs transition ${
                    aircraftFilter === "watchlist"
                      ? "bg-sky-500 text-slate-950"
                      : "border border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                  onClick={() => setAircraftFilter("watchlist")}
                  type="button"
                >
                  {t("layers.watchlistOnly")}
                </button>
              </div>

              {aircraftFilter === "watchlist" || visible.watchlist ? <WatchlistGroupFilter /> : null}
            </section>
          </div>
        </OverlayPanel>
      ) : null}
    </div>
  );
}

function WatchlistGroupFilter(): JSX.Element {
  const { t } = useI18n();
  const groups = useWatchlistStore((state) => state.groups);
  const toggleGroupVisibility = useWatchlistStore((state) => state.toggleGroupVisibility);

  if (groups.length === 0) {
    return <p className="mt-3 text-xs italic text-slate-500">{t("layers.noWatchlistGroups")}</p>;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
      {groups.map((group) => (
        <label className="flex cursor-pointer items-center gap-2" key={group.id}>
          <input
            aria-label={`${group.name} ${group.entryCount ?? group.entries?.length ?? 0}`}
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
