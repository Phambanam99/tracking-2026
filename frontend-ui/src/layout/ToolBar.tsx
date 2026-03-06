import { useState, useCallback } from "react";
import type { BaseLayerType } from "../features/map/layers/baseLayer";
import type { TrackingMode } from "../features/map/store/useTrackingModeStore";
import { list } from "../features/map/providers/registry";
import { loadCustomProviders } from "../features/map/providers/customProviderStorage";
import { useBaseLayerStore } from "../features/map/providers/useBaseLayerStore";
import { AddProviderDialog } from "../features/map/components/AddProviderDialog";
import { IconButton } from "../shared/components/IconButton";
import { useI18n } from "../shared/i18n/I18nProvider";

type ToolBarProps = {
  activePanel: "search" | "watchlist" | "tracked" | null;
  isWatchlistEnabled: boolean;
  trackedShipCount: number;
  isLayerPanelOpen: boolean;
  isPlaybackOpen: boolean;
  baseLayerType: BaseLayerType;
  trackingMode: TrackingMode;
  isShipTrackingEnabled: boolean;
  showAircraftControls: boolean;
  className?: string;
  onToggleSearch: () => void;
  onToggleWatchlist: () => void;
  onToggleTrackedShips: () => void;
  onToggleLayerPanel: () => void;
  onTogglePlayback: () => void;
  onBaseLayerChange: (type: BaseLayerType) => void;
  onTrackingModeChange: (mode: TrackingMode) => void;
};

export function ToolBar({
  activePanel,
  isWatchlistEnabled,
  trackedShipCount,
  isLayerPanelOpen,
  isPlaybackOpen,
  baseLayerType,
  trackingMode,
  isShipTrackingEnabled,
  showAircraftControls,
  className,
  onToggleSearch,
  onToggleWatchlist,
  onToggleTrackedShips,
  onToggleLayerPanel,
  onTogglePlayback,
  onBaseLayerChange,
  onTrackingModeChange,
}: ToolBarProps): JSX.Element {
  const { t } = useI18n();
  const showLayerControls = showAircraftControls || trackingMode === "ship";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const setProvider = useBaseLayerStore((state) => state.setProvider);
  const activeProviderId = useBaseLayerStore((state) => state.activeProviderId);

  const customProviders = loadCustomProviders();

  const handleProviderAdded = useCallback((providerId: string) => {
    setRefreshKey((k) => k + 1);
    setProvider(providerId);
  }, [setProvider]);

  return (
    <>
      <div className={`pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 ${className ?? ""}`}>
        <div className="glass-panel-strong pointer-events-auto flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl">
          <IconButton ariaLabel={t("toolbar.toggleSearch")} active={activePanel === "search"} onClick={onToggleSearch} tooltip={t("toolbar.search")}>
            <SearchIcon />
          </IconButton>

          {showAircraftControls ? (
            <>
              <IconButton
                ariaLabel={t("toolbar.toggleWatchlist")}
                active={activePanel === "watchlist"}
                disabled={!isWatchlistEnabled}
                onClick={onToggleWatchlist}
                tooltip={isWatchlistEnabled ? t("toolbar.watchlist") : t("toolbar.watchlistAuth")}
              >
                <WatchIcon />
              </IconButton>
              <IconButton
                ariaLabel={t("toolbar.togglePlayback")}
                active={isPlaybackOpen}
                onClick={onTogglePlayback}
                tooltip={t("toolbar.playback")}
              >
                <PlaybackIcon />
              </IconButton>
            </>
          ) : null}

          {!showAircraftControls ? (
            <IconButton
              ariaLabel={t("toolbar.toggleTrackedShips")}
              active={activePanel === "tracked"}
              onClick={onToggleTrackedShips}
              tooltip={t("toolbar.trackedShips", { count: trackedShipCount })}
            >
              <TrackShipIcon />
            </IconButton>
          ) : null}

          {showLayerControls ? (
            <IconButton
              ariaLabel={t("toolbar.toggleLayers")}
              active={isLayerPanelOpen}
              onClick={onToggleLayerPanel}
              tooltip={t("toolbar.layers")}
            >
              <LayerIcon />
            </IconButton>
          ) : null}

          <div className="mx-1 h-8 w-px bg-slate-700/80" />

          {isShipTrackingEnabled ? (
            <>
              <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/75 p-1">
                <ModeButton
                  isActive={trackingMode === "aircraft"}
                  label={t("toolbar.modeAircraft")}
                  onClick={() => onTrackingModeChange("aircraft")}
                />
                <ModeButton
                  isActive={trackingMode === "ship"}
                  label={t("toolbar.modeShip")}
                  onClick={() => onTrackingModeChange("ship")}
                />
              </div>

              <div className="mx-1 h-8 w-px bg-slate-700/80" />
            </>
          ) : null}

          <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/75 p-1" data-refresh={refreshKey}>
            <BaseLayerButton
              isActive={baseLayerType === "osm" && activeProviderId === "osm"}
              label="OSM"
              onClick={() => {
                onBaseLayerChange("osm");
                setProvider("osm");
              }}
            />
            <BaseLayerButton
              isActive={baseLayerType === "satellite"}
              label="Sat"
              onClick={() => onBaseLayerChange("satellite")}
            />
            {customProviders.map((p) => (
              <BaseLayerButton
                key={p.id}
                isActive={activeProviderId === p.id}
                label={p.name}
                onClick={() => setProvider(p.id)}
              />
            ))}
            <button
              type="button"
              className="flex items-center justify-center rounded-full w-6 h-6 text-slate-400 hover:bg-slate-800 hover:text-cyan-300 transition-colors text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              onClick={() => setDialogOpen(true)}
              title={t("map.customProvider.title")}
              aria-label={t("map.customProvider.title")}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <AddProviderDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setRefreshKey((k) => k + 1); }}
        onProviderAdded={handleProviderAdded}
      />
    </>
  );
}

type BaseLayerButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function BaseLayerButton({ label, isActive, onClick }: BaseLayerButtonProps): JSX.Element {
  return <ModeButton isActive={isActive} label={label} onClick={onClick} />;
}

function ModeButton({ label, isActive, onClick }: BaseLayerButtonProps): JSX.Element {
  return (
    <button
      aria-pressed={isActive}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${isActive
          ? "bg-cyan-300 text-slate-950"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SearchIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function WatchIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 5c4.2 0 7.8 2.7 9 6.5-1.2 3.8-4.8 6.5-9 6.5s-7.8-2.7-9-6.5C4.2 7.7 7.8 5 12 5Z" />
      <circle cx="12" cy="11.5" r="2.5" />
    </svg>
  );
}

function PlaybackIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7-11-7Z" fill="currentColor" stroke="none" />
      <path d="M5 5v14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayerIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 4 4 8l8 4 8-4-8-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 12 8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 16 8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrackShipIcon(): JSX.Element {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 12h11" strokeLinecap="round" />
      <path d="m11 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="12" r="3" />
    </svg>
  );
}
