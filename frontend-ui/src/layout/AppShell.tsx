import { useEffect, useState } from "react";
import { logout, useAuthStore } from "../features/auth/store/useAuthStore";
import { AircraftFeatureLayer } from "../features/aircraft/components/AircraftFeatureLayer";
import { AltitudeLegend } from "../features/map/components/AltitudeLegend";
import { LayerPanel } from "../features/map/components/LayerPanel";
import { MapContainer } from "../features/map/components/MapContainer";
import type { BaseLayerType } from "../features/map/layers/baseLayer";
import { useTrackingModeStore, type TrackingMode } from "../features/map/store/useTrackingModeStore";
import { PlaybackBar } from "../features/playback/components/PlaybackBar";
import { PlaybackDialog } from "../features/playback/components/PlaybackDialog";
import { usePlaybackStore } from "../features/playback/store/usePlaybackStore";
import { ShipFeatureLayer } from "../features/ship/components/ShipFeatureLayer";
import { ShipSearchPanel } from "../features/ship/components/ShipSearchPanel";
import { SearchPanel } from "../features/search/components/SearchPanel";
import { WatchlistPanel } from "../features/watchlist/components/WatchlistPanel";
import { useWatchlistSync } from "../features/watchlist/hooks/useWatchlistSync";
import { useKeyboardShortcuts } from "../shared/hooks/useKeyboardShortcuts";
import { useMediaQuery } from "../shared/hooks/useMediaQuery";
import { BottomTabBar } from "./BottomTabBar";
import { CommandBar } from "./CommandBar";
import { Sidebar, type SidebarPanelId } from "./Sidebar";
import { ToolBar } from "./ToolBar";

type AppShellProps = {
  isAdmin: boolean;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAdminUsers: () => void;
  onOpenAdminApiKeys: () => void;
};

export function AppShell({
  isAdmin,
  onOpenLogin,
  onOpenRegister,
  onOpenAdminUsers,
  onOpenAdminApiKeys,
}: AppShellProps): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const username = useAuthStore((state) => state.username);
  const [activePanel, setActivePanel] = useState<SidebarPanelId>(null);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [baseLayerType, setBaseLayerType] = useState<BaseLayerType>("osm");
  const trackingMode = useTrackingModeStore((state) => state.mode);
  const setTrackingMode = useTrackingModeStore((state) => state.setMode);
  const isPlaybackOpen = usePlaybackStore((state) => state.isOpen);
  const openPlaybackDialog = usePlaybackStore((state) => state.openDialog);
  const closePlayback = usePlaybackStore((state) => state.close);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isShipTrackingEnabled = import.meta.env.VITE_SHIP_TRACKING_ENABLED === "true";
  const activeTrackingMode: TrackingMode = isShipTrackingEnabled ? trackingMode : "aircraft";
  const showAircraftControls = activeTrackingMode === "aircraft";

  useWatchlistSync();

  useEffect(() => {
    if (!isAuthenticated && activePanel === "watchlist") {
      setActivePanel(null);
    }
  }, [activePanel, isAuthenticated]);

  useEffect(() => {
    if (activeTrackingMode === "ship") {
      setIsLayerPanelOpen(false);
      closePlayback();
      setActivePanel((current) => (current === "watchlist" ? null : current));
    }
  }, [activeTrackingMode, closePlayback]);

  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      handler: () => setIsCommandBarOpen(true),
    },
    {
      key: "/",
      handler: () => setIsCommandBarOpen(true),
    },
    {
      key: "Escape",
      preventDefault: false,
      handler: () => {
        setIsCommandBarOpen(false);
        setActivePanel(null);
        setIsLayerPanelOpen(false);
        closePlayback();
      },
    },
  ]);

  const mobileSheetDockClassName = "left-3 right-3 top-auto bottom-20 h-[min(68vh,34rem)] w-auto";
  const desktopSearchDockClassName = "left-24 animate-slide-in-left";
  const mobileSearchDockClassName = mobileSheetDockClassName;
  const desktopWatchlistDockClassName = "left-24 animate-slide-in-left";
  const mobileWatchlistDockClassName = mobileSheetDockClassName;
  const desktopLayerDockClassName = "right-0 top-auto bottom-24 h-auto max-h-[70vh]";
  const mobileLayerDockClassName =
    "left-1/2 right-auto top-auto bottom-20 h-[min(68vh,34rem)] w-[calc(100vw-1.5rem)] -translate-x-1/2";

  function toggleSearchPanel(): void {
    setActivePanel((value) => (value === "search" ? null : "search"));
    if (isMobile) {
      setIsLayerPanelOpen(false);
      closePlayback();
    }
  }

  function toggleWatchlistPanel(): void {
    setActivePanel((value) => (value === "watchlist" ? null : "watchlist"));
    if (isMobile) {
      setIsLayerPanelOpen(false);
      closePlayback();
    }
  }

  function toggleLayerPanel(): void {
    setIsLayerPanelOpen((value) => !value);
    if (isMobile) {
      setActivePanel(null);
      closePlayback();
    }
  }

  function togglePlaybackPanel(): void {
    if (isPlaybackOpen) {
      closePlayback();
      return;
    }

    openPlaybackDialog();
    if (isMobile) {
      setActivePanel(null);
      setIsLayerPanelOpen(false);
    }
  }

  function handleTrackingModeChange(mode: TrackingMode): void {
    if (!isShipTrackingEnabled) {
      return;
    }
    setTrackingMode(mode);
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950 text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_24%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.16),transparent_20%)]" />

      <MapContainer baseLayerType={baseLayerType} className="border-0 rounded-none" showToolbar={false}>
        {activeTrackingMode === "aircraft" ? <AircraftFeatureLayer /> : <ShipFeatureLayer />}
        {showAircraftControls ? <AltitudeLegend /> : null}
        {showAircraftControls ? (
          <LayerPanel
            animationClassName={isMobile ? "animate-slide-in-up" : "animate-slide-in-left"}
            className={isMobile ? "absolute inset-x-0 bottom-0 z-30" : undefined}
            dockClassName={isMobile ? mobileLayerDockClassName : desktopLayerDockClassName}
            enableSwipeClose={isMobile}
            onOpenChange={setIsLayerPanelOpen}
            open={isLayerPanelOpen}
            showTrigger={false}
            widthClassName={isMobile ? "w-[calc(100vw-1.5rem)]" : "w-80"}
          />
        ) : null}
        {showAircraftControls ? <PlaybackDialog /> : null}
        {showAircraftControls ? <PlaybackBar /> : null}
        <CommandBar
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          isOpen={isCommandBarOpen}
          onClose={() => setIsCommandBarOpen(false)}
          onOpen={() => setIsCommandBarOpen(true)}
          onOpenAdminApiKeys={onOpenAdminApiKeys}
          onOpenAdminUsers={onOpenAdminUsers}
          onOpenLogin={onOpenLogin}
          onOpenRegister={onOpenRegister}
          onOpenSearchPanel={() => {
            setActivePanel("search");
            if (isMobile) {
              setIsLayerPanelOpen(false);
              closePlayback();
            }
            setIsCommandBarOpen(false);
          }}
          onOpenWatchlistPanel={() => {
            handleTrackingModeChange("aircraft");
            setActivePanel("watchlist");
            if (isMobile) {
              setIsLayerPanelOpen(false);
              closePlayback();
            }
            setIsCommandBarOpen(false);
          }}
        />
        {activePanel === "search" && activeTrackingMode === "aircraft" ? (
          <SearchPanel
            animationClassName={isMobile ? "animate-slide-in-up" : "animate-slide-in-left"}
            dockClassName={isMobile ? mobileSearchDockClassName : desktopSearchDockClassName}
            enableSwipeClose={isMobile}
            onClose={() => setActivePanel(null)}
          />
        ) : null}
        {activePanel === "search" && activeTrackingMode === "ship" ? (
          <ShipSearchPanel
            animationClassName={isMobile ? "animate-slide-in-up" : "animate-slide-in-left"}
            dockClassName={isMobile ? mobileSearchDockClassName : desktopSearchDockClassName}
            enableSwipeClose={isMobile}
            onClose={() => setActivePanel(null)}
          />
        ) : null}
        {showAircraftControls && activePanel === "watchlist" && isAuthenticated ? (
          <WatchlistPanel
            animationClassName={isMobile ? "animate-slide-in-up" : "animate-slide-in-left"}
            dockClassName={isMobile ? mobileWatchlistDockClassName : desktopWatchlistDockClassName}
            enableSwipeClose={isMobile}
            onClose={() => setActivePanel(null)}
            placement={isMobile ? "right" : "left"}
          />
        ) : null}
        <ToolBar
          activePanel={activePanel}
          baseLayerType={baseLayerType}
          className="hidden md:block"
          isLayerPanelOpen={isLayerPanelOpen}
          isPlaybackOpen={isPlaybackOpen}
          isShipTrackingEnabled={isShipTrackingEnabled}
          isWatchlistEnabled={isAuthenticated}
          onBaseLayerChange={setBaseLayerType}
          onTrackingModeChange={handleTrackingModeChange}
          onToggleLayerPanel={toggleLayerPanel}
          onTogglePlayback={togglePlaybackPanel}
          onToggleSearch={toggleSearchPanel}
          onToggleWatchlist={() => {
            if (!isAuthenticated) {
              onOpenLogin();
              return;
            }
            toggleWatchlistPanel();
          }}
          showAircraftControls={showAircraftControls}
          trackingMode={activeTrackingMode}
        />
        <BottomTabBar
          activePanel={activePanel}
          isLayerPanelOpen={isLayerPanelOpen}
          isPlaybackOpen={isPlaybackOpen}
          isShipTrackingEnabled={isShipTrackingEnabled}
          isWatchlistEnabled={isAuthenticated}
          onTrackingModeChange={handleTrackingModeChange}
          onToggleLayerPanel={toggleLayerPanel}
          onTogglePlayback={togglePlaybackPanel}
          onToggleSearch={toggleSearchPanel}
          onToggleWatchlist={() => {
            if (!isAuthenticated) {
              onOpenLogin();
              return;
            }
            toggleWatchlistPanel();
          }}
          showAircraftControls={showAircraftControls}
          trackingMode={activeTrackingMode}
        />
      </MapContainer>

      <Sidebar
        activePanel={activePanel}
        isAdmin={isAdmin}
        isAuthenticated={isAuthenticated}
        onLogout={() => void logout()}
        onOpenAdminApiKeys={onOpenAdminApiKeys}
        onOpenAdminUsers={onOpenAdminUsers}
        onOpenLogin={onOpenLogin}
        onOpenRegister={onOpenRegister}
        onSelectPanel={(panel) => {
          if (panel === "watchlist") {
            handleTrackingModeChange("aircraft");
          }
          setActivePanel(panel);
        }}
        onShowMap={() => setActivePanel(null)}
        username={username}
      />
    </div>
  );
}
