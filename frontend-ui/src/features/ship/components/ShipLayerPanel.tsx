import { useState } from "react";
import { OverlayPanel } from "../../../shared/components/OverlayPanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useShipLayerStore, type ShipLayerId } from "../store/useShipLayerStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

type ShipLayerPanelProps = {
  dockClassName?: string;
  animationClassName?: string;
  widthClassName?: string;
  enableSwipeClose?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SHIP_LAYERS: Array<{
  id: ShipLayerId;
  labelKey: string;
  descriptionKey: string;
  swatchClassName: string;
}> = [
  {
    id: "ships",
    labelKey: "ship.layers.liveShips",
    descriptionKey: "ship.layers.liveShipsDescription",
    swatchClassName: "bg-teal-400",
  },
  {
    id: "labels",
    labelKey: "ship.layers.labels",
    descriptionKey: "ship.layers.labelsDescription",
    swatchClassName: "bg-slate-200",
  },
  {
    id: "trail",
    labelKey: "ship.layers.trail",
    descriptionKey: "ship.layers.trailDescription",
    swatchClassName: "bg-indigo-300",
  },
];

export function ShipLayerPanel({
  dockClassName,
  animationClassName,
  widthClassName,
  enableSwipeClose = false,
  onOpenChange,
}: ShipLayerPanelProps): JSX.Element {
  const { t } = useI18n();
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const visible = useShipLayerStore((state) => state.visible);
  const followSelected = useShipLayerStore((state) => state.followSelected);
  const trackedOnly = useShipLayerStore((state) => state.trackedOnly);
  const trackedGroupFilterIds = useShipLayerStore((state) => state.trackedGroupFilterIds);
  const toggle = useShipLayerStore((state) => state.toggle);
  const setFollowSelected = useShipLayerStore((state) => state.setFollowSelected);
  const setTrackedOnly = useShipLayerStore((state) => state.setTrackedOnly);
  const toggleTrackedGroupFilterId = useShipLayerStore((state) => state.toggleTrackedGroupFilterId);
  const clearTrackedGroupFilter = useShipLayerStore((state) => state.clearTrackedGroupFilter);
  const groups = useTrackedShipStore((state) => state.groups);

  return (
    <OverlayPanel
      ariaLabel="Ship layer panel"
      animationClassName={animationClassName}
      closeLabel={t("ship.layers.close")}
      description={t("ship.layers.description")}
      dockClassName={dockClassName}
      enableSwipeClose={enableSwipeClose}
      onClose={() => onOpenChange?.(false)}
      title={t("ship.layers.title")}
      widthClassName={widthClassName ?? "w-80"}
    >
      <div className="space-y-4 p-4">
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
          <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">{t("layers.visibility")}</p>
          <div className="space-y-2">
            {SHIP_LAYERS.map((layer) => (
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3" key={layer.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    aria-label={t(layer.labelKey)}
                    checked={visible[layer.id]}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
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
          <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">{t("ship.layers.tracking")}</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
            <input
              aria-label={t("ship.layers.followSelected")}
              checked={followSelected}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              onChange={(event) => setFollowSelected(event.target.checked)}
              type="checkbox"
            />
            <span className="flex-1">
              <span className="block text-sm text-slate-100">{t("ship.layers.followSelected")}</span>
              <span className="mt-1 block text-[11px] text-slate-500">{t("ship.layers.followSelectedDescription")}</span>
            </span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
            <input
              aria-label={t("ship.layers.trackedOnly")}
              checked={trackedOnly}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              onChange={(event) => setTrackedOnly(event.target.checked)}
              type="checkbox"
            />
            <span className="flex-1">
              <span className="block text-sm text-slate-100">{t("ship.layers.trackedOnly")}</span>
              <span className="mt-1 block text-[11px] text-slate-500">{t("ship.layers.trackedOnlyDescription")}</span>
            </span>
          </label>
          {trackedOnly ? (
            <div className="mt-2 rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
              <p className="block text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {t("ship.layers.trackedGroupFilter")}
              </p>
              <div className="mt-2">
                <button
                  aria-expanded={groupDropdownOpen}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-left text-xs text-slate-100 transition hover:border-slate-500"
                  onClick={() => setGroupDropdownOpen((open) => !open)}
                  type="button"
                >
                  <span>
                    {trackedGroupFilterIds.length === 0
                      ? t("ship.layers.trackedGroupAll")
                      : `${trackedGroupFilterIds.length} ${t("ship.layers.trackedGroupSelectedCount")}`}
                  </span>
                  <span className="text-slate-400">{groupDropdownOpen ? "▴" : "▾"}</span>
                </button>
              </div>
              {groupDropdownOpen ? (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-800/70 bg-slate-900/70 p-2">
                  <button
                    className="w-full rounded-md border border-slate-700 px-2 py-1 text-left text-xs text-slate-200 transition hover:border-slate-500"
                    onClick={clearTrackedGroupFilter}
                    type="button"
                  >
                    {t("ship.layers.trackedGroupAll")}
                  </button>
                  {groups.map((group) => (
                    <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-slate-200" key={group.id}>
                      <input
                        aria-label={`${t("ship.layers.trackedGroupFilter")} ${group.name}`}
                        checked={trackedGroupFilterIds.includes(group.id)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                        onChange={() => toggleTrackedGroupFilterId(group.id)}
                        type="checkbox"
                      />
                      <span className="truncate">{group.name}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trackedGroupFilterIds.map((groupId) => {
                  const group = groups.find((item) => item.id === groupId);
                  if (!group) {
                    return null;
                  }
                  return (
                    <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100" key={groupId}>
                      {group.name}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{t("ship.layers.trackedGroupFilterHint")}</p>
            </div>
          ) : null}
        </section>
      </div>
    </OverlayPanel>
  );
}
