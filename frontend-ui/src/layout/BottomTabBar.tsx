import { useI18n } from "../shared/i18n/I18nProvider";

type BottomTabBarProps = {
  activePanel: "search" | "watchlist" | null;
  isWatchlistEnabled: boolean;
  isPlaybackOpen: boolean;
  isLayerPanelOpen: boolean;
  onToggleSearch: () => void;
  onToggleWatchlist: () => void;
  onTogglePlayback: () => void;
  onToggleLayerPanel: () => void;
};

export function BottomTabBar({
  activePanel,
  isWatchlistEnabled,
  isPlaybackOpen,
  isLayerPanelOpen,
  onToggleSearch,
  onToggleWatchlist,
  onTogglePlayback,
  onToggleLayerPanel,
}: BottomTabBarProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 md:hidden">
      <div className="glass-panel-strong pointer-events-auto grid grid-cols-4 gap-2 rounded-[24px] p-2 shadow-2xl">
        <TabButton
          active={activePanel === "search"}
          ariaLabel={t("toolbar.toggleSearch")}
          label={t("toolbar.search")}
          onClick={onToggleSearch}
        >
          <SearchIcon />
        </TabButton>
        <TabButton
          active={activePanel === "watchlist"}
          ariaLabel={t("toolbar.toggleWatchlist")}
          disabled={!isWatchlistEnabled}
          label={t("toolbar.watchlist")}
          onClick={onToggleWatchlist}
        >
          <WatchIcon />
        </TabButton>
        <TabButton
          active={isPlaybackOpen}
          ariaLabel={t("toolbar.togglePlayback")}
          label={t("toolbar.playback")}
          onClick={onTogglePlayback}
        >
          <PlaybackIcon />
        </TabButton>
        <TabButton
          active={isLayerPanelOpen}
          ariaLabel={t("toolbar.toggleLayers")}
          label={t("toolbar.layers")}
          onClick={onToggleLayerPanel}
        >
          <LayerIcon />
        </TabButton>
      </div>
    </div>
  );
}

type TabButtonProps = {
  active: boolean;
  ariaLabel: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: JSX.Element;
};

function TabButton({ active, ariaLabel, label, disabled = false, onClick, children }: TabButtonProps): JSX.Element {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[11px] transition ${
        active
          ? "bg-cyan-300 text-slate-950"
          : "text-slate-200 hover:bg-slate-900/90"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="h-5 w-5">{children}</span>
      <span>{label}</span>
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
