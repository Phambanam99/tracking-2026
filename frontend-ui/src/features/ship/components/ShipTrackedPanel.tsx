import { useState } from "react";
import { fromLonLat } from "ol/proj";
import { OverlayPanel } from "../../../shared/components/OverlayPanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMapContext } from "../../map/context/MapContext";
import { searchShipGlobal, type ShipSearchResult } from "../api/shipSearchApi";
import { useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

type ShipTrackedPanelProps = {
  onClose: () => void;
  dockClassName?: string;
  animationClassName?: string;
  enableSwipeClose?: boolean;
};

type AddShipStatus = "idle" | "searching" | "error";

const TRACKED_FOCUS_ZOOM = 9;

function toTrackedShip(result: ShipSearchResult) {
  return {
    mmsi: result.mmsi,
    lat: result.lat,
    lon: result.lon,
    speed: result.speed ?? null,
    course: result.course ?? null,
    heading: result.heading ?? null,
    navStatus: result.navStatus ?? null,
    vesselName: result.vesselName ?? null,
    vesselType: result.vesselType ?? null,
    imo: result.imo ?? null,
    callSign: result.callSign ?? null,
    destination: result.destination ?? null,
    eta: null,
    eventTime: result.eventTime,
    sourceId: result.sourceId ?? "service-query",
    isHistorical: false,
    metadata: { isMilitary: result.isMilitary ?? false },
    lastSeen: Date.now(),
  };
}

function IconButton({
  ariaLabel,
  onClick,
  children,
  tone = "neutral",
  disabled = false,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: JSX.Element;
  tone?: "neutral" | "accent" | "danger";
  disabled?: boolean;
}): JSX.Element {
  const toneClassName =
    tone === "accent"
      ? "border-cyan-500/60 text-cyan-100 hover:bg-cyan-500/10"
      : tone === "danger"
        ? "border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
        : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white";

  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${toneClassName} ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12 6 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 15z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LocateIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

function DetailIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M5 5h14v14H5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShipTrackedPanel({
  onClose,
  dockClassName,
  animationClassName,
  enableSwipeClose = false,
}: ShipTrackedPanelProps): JSX.Element {
  const { t } = useI18n();
  const { map } = useMapContext();
  const [groupName, setGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [searchStatus, setSearchStatus] = useState<AddShipStatus>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ShipSearchResult[]>([]);
  const ships = useShipStore((state) => state.ships);
  const upsertShip = useShipStore((state) => state.upsertShip);
  const selectShip = useShipStore((state) => state.selectShip);
  const showDetails = useShipStore((state) => state.showDetails);
  const groups = useTrackedShipStore((state) => state.groups);
  const activeGroupId = useTrackedShipStore((state) => state.activeGroupId);
  const createGroup = useTrackedShipStore((state) => state.createGroup);
  const renameGroup = useTrackedShipStore((state) => state.renameGroup);
  const deleteGroup = useTrackedShipStore((state) => state.deleteGroup);
  const moveShipToGroup = useTrackedShipStore((state) => state.moveShipToGroup);
  const setActiveGroup = useTrackedShipStore((state) => state.setActiveGroup);
  const toggleGroupVisibility = useTrackedShipStore((state) => state.toggleGroupVisibility);
  const trackedMmsis = useTrackedShipStore((state) => state.trackedMmsis);
  const addTrackedShip = useTrackedShipStore((state) => state.addTrackedShip);
  const removeTrackedShip = useTrackedShipStore((state) => state.removeTrackedShip);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;

  function focusShip(mmsi: string): void {
    const ship = ships[mmsi];
    selectShip(mmsi, "viewport");
    if (!ship || !map) {
      return;
    }

    const view = map.getView();
    const currentZoom = view.getZoom() ?? TRACKED_FOCUS_ZOOM;
    view.animate({
      center: fromLonLat([ship.lon, ship.lat]),
      zoom: Math.max(currentZoom, TRACKED_FOCUS_ZOOM),
      duration: 350,
    });
  }

  function handleCreateGroup(): void {
    if (!groupName.trim()) {
      return;
    }

    createGroup(groupName.trim());
    setGroupName("");
  }

  function handleRenameGroup(groupId: string): void {
    if (!editingGroupName.trim()) {
      return;
    }

    renameGroup(groupId, editingGroupName.trim());
    setEditingGroupId(null);
    setEditingGroupName("");
  }

  async function handleSearchSubmit(): Promise<void> {
    const normalized = searchValue.trim();
    if (!normalized || !activeGroup) {
      return;
    }

    if (/^\d{6,}$/.test(normalized)) {
      addTrackedShip(normalized, activeGroup.id);
      setSearchResults([]);
      setSearchError(null);
    }

    setSearchStatus("searching");
    setSearchError(null);

    try {
      const response = await searchShipGlobal(normalized);
      setSearchResults(response.results.slice(0, 8));
      setSearchStatus("idle");
    } catch (error: unknown) {
      setSearchStatus("error");
      setSearchError(error instanceof Error ? error.message : t("ship.trackedPanel.searchFailed"));
    }
  }

  function handleAddResult(result: ShipSearchResult): void {
    if (!activeGroup) {
      return;
    }

    upsertShip(toTrackedShip(result));
    addTrackedShip(result.mmsi, activeGroup.id);
  }

  return (
    <OverlayPanel
      ariaLabel="Tracked ships panel"
      animationClassName={animationClassName}
      closeLabel={t("ship.trackedPanel.close")}
      description={t("ship.trackedPanel.description")}
      dockClassName={dockClassName}
      enableSwipeClose={enableSwipeClose}
      onClose={onClose}
      title={t("ship.trackedPanel.title")}
      widthClassName="w-[25rem]"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-slate-800/80 px-3 py-3">
          <div className="flex gap-2">
            <input
              aria-label={t("ship.trackedPanel.groupName")}
              className="flex-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-yellow-300/70"
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={t("ship.trackedPanel.newGroup")}
              type="text"
              value={groupName}
            />
            <IconButton ariaLabel={t("ship.trackedPanel.createGroup")} onClick={handleCreateGroup} tone="accent">
              <PlusIcon />
            </IconButton>
          </div>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-slate-400">{t("ship.trackedPanel.groups")}</p>

          {groups.length === 0 ? (
            <div className="mt-10 text-center">
              <p className="text-sm text-slate-400">{t("ship.trackedPanel.empty")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("ship.trackedPanel.emptyDescription")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => {
                const isActive = activeGroupId === group.id;
                const groupShips = (group.mmsis ?? []).map((mmsi) => ({
                  mmsi,
                  ship: ships[mmsi] ?? null,
                }));

                return (
                  <div
                    className={`rounded-2xl border p-2 ${
                      isActive ? "border-yellow-300/40 bg-yellow-300/10" : "border-slate-800/80 bg-slate-950/45"
                    }`}
                    key={group.id}
                  >
                    <button
                      aria-label={`${t("ship.trackedPanel.activeGroup")} ${group.name}`}
                      aria-pressed={isActive}
                      className="w-full text-left"
                      onClick={() => setActiveGroup(group.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                          <span className="truncate text-sm font-medium text-slate-100">{group.name}</span>
                        </div>
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                          {group.mmsis.length}
                        </span>
                      </div>
                    </button>

                    <div className="mt-2 flex gap-1.5">
                      <IconButton
                        ariaLabel={`${group.name} ${t("ship.trackedPanel.visibleOnMap")}`}
                        onClick={() => toggleGroupVisibility(group.id)}
                        tone={group.visibleOnMap ? "accent" : "neutral"}
                      >
                        <EyeIcon />
                      </IconButton>
                      <IconButton
                        ariaLabel={t("ship.trackedPanel.edit")}
                        onClick={() => {
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      {group.id !== "default" ? (
                        <IconButton ariaLabel={t("ship.trackedPanel.delete")} onClick={() => deleteGroup(group.id)} tone="danger">
                          <TrashIcon />
                        </IconButton>
                      ) : null}
                    </div>

                    {editingGroupId === group.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          className="flex-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-yellow-300/70"
                          onChange={(event) => setEditingGroupName(event.target.value)}
                          type="text"
                          value={editingGroupName}
                        />
                        <IconButton ariaLabel={t("ship.trackedPanel.save")} onClick={() => handleRenameGroup(group.id)} tone="accent">
                          <PlusIcon />
                        </IconButton>
                      </div>
                    ) : null}

                    {isActive ? (
                      <div className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-950/45 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-100">{group.name}</h3>
                          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300">
                            {group.mmsis.length} {t("ship.trackedPanel.ships")}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <input
                            aria-label={t("ship.trackedPanel.searchLabel")}
                            className="flex-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-cyan-300/70"
                            onChange={(event) => setSearchValue(event.target.value)}
                            placeholder={t("ship.trackedPanel.searchPlaceholder")}
                            type="text"
                            value={searchValue}
                          />
                          <IconButton
                            ariaLabel={t("ship.trackedPanel.addShip")}
                            onClick={() => void handleSearchSubmit()}
                            tone="accent"
                          >
                            <SearchIcon />
                          </IconButton>
                        </div>

                        {searchStatus === "searching" ? (
                          <p className="mt-2 text-xs text-slate-400">{t("search.searching")}</p>
                        ) : null}
                        {searchError ? <p className="mt-2 text-xs text-rose-300">{searchError}</p> : null}

                        {searchResults.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {searchResults.map((result) => (
                              <div
                                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5"
                                key={`result-${result.mmsi}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-mono text-xs font-semibold text-cyan-200">{result.mmsi}</p>
                                    <p className="mt-1 truncate text-sm text-slate-100">{result.vesselName ?? result.mmsi}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{result.vesselType ?? result.sourceId ?? "-"}</p>
                                  </div>
                                  <IconButton
                                    ariaLabel={trackedMmsis[result.mmsi] ? t("ship.trackedPanel.added") : t("ship.trackedPanel.add")}
                                    onClick={() => handleAddResult(result)}
                                    tone="accent"
                                  >
                                    <PlusIcon />
                                  </IconButton>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {groupShips.length === 0 ? (
                          <div className="mt-6 text-center">
                            <p className="text-sm text-slate-400">{t("ship.trackedPanel.groupEmpty")}</p>
                            <p className="mt-1 text-xs text-slate-500">{t("ship.trackedPanel.groupEmptyDescription")}</p>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {groupShips.map(({ mmsi, ship }) => {
                              const otherGroups = groups.filter((candidate) => candidate.id !== group.id && !candidate.mmsis.includes(mmsi));
                              return (
                                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/55 p-3" key={`${group.id}-${mmsi}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start gap-2">
                                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10">
                                          <img alt="" className="h-4 w-4 opacity-90" src="/vessel-icon.svg" />
                                        </span>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-slate-100">
                                            {ship?.vesselName ?? t("ship.trackedPanel.awaitingData")}
                                          </p>
                                          <p className="mt-1 font-mono text-xs font-semibold text-yellow-100">{mmsi}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <IconButton ariaLabel={t("ship.untrack")} onClick={() => removeTrackedShip(mmsi, group.id)} tone="danger">
                                      <TrashIcon />
                                    </IconButton>
                                  </div>

                                  <div className="mt-3 flex gap-2">
                                    <IconButton ariaLabel={t("ship.search.focus")} onClick={() => focusShip(mmsi)}>
                                      <LocateIcon />
                                    </IconButton>
                                    <IconButton
                                      ariaLabel={t("ship.popup.viewDetails")}
                                      onClick={() => {
                                        focusShip(mmsi);
                                        showDetails(mmsi, "viewport");
                                      }}
                                      tone="accent"
                                      disabled={!ship}
                                    >
                                      <DetailIcon />
                                    </IconButton>
                                  </div>

                                  {otherGroups.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {otherGroups.map((candidate) => (
                                        <button
                                          aria-label={`${t("ship.trackedPanel.moveToGroup")} ${candidate.name}`}
                                          className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 transition hover:border-slate-500 hover:text-white"
                                          key={`${mmsi}-move-${candidate.id}`}
                                          onClick={() => moveShipToGroup(mmsi, group.id, candidate.id)}
                                          type="button"
                                        >
                                          {candidate.name}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </OverlayPanel>
  );
}
