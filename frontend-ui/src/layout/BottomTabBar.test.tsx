import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../shared/i18n/I18nProvider";
import { BottomTabBar } from "./BottomTabBar";

describe("BottomTabBar", () => {
  test("toggles mobile actions and disables watchlist when unavailable", () => {
    const onToggleSearch = vi.fn();
    const onToggleWatchlist = vi.fn();
    const onTogglePlayback = vi.fn();
    const onToggleLayerPanel = vi.fn();
    const onTrackingModeChange = vi.fn();

    render(
      <I18nProvider defaultLanguage="en">
        <BottomTabBar
          activePanel="search"
          isLayerPanelOpen={false}
          isPlaybackOpen={false}
          isShipTrackingEnabled={true}
          isWatchlistEnabled={false}
          onToggleLayerPanel={onToggleLayerPanel}
          onTogglePlayback={onTogglePlayback}
          onToggleSearch={onToggleSearch}
          onTrackingModeChange={onTrackingModeChange}
          onToggleWatchlist={onToggleWatchlist}
          showAircraftControls={true}
          trackingMode="aircraft"
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle search panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle playback panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle layer settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Ships" }));

    expect(onToggleSearch).toHaveBeenCalledTimes(1);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onToggleLayerPanel).toHaveBeenCalledTimes(1);
    expect(onTrackingModeChange).toHaveBeenCalledWith("ship");
    expect(screen.getByRole("button", { name: "Toggle watchlist panel" })).toBeDisabled();
  });

  test("keeps search visible but hides aircraft-only controls in ship mode", () => {
    render(
      <I18nProvider defaultLanguage="en">
        <BottomTabBar
          activePanel={null}
          isLayerPanelOpen={false}
          isPlaybackOpen={false}
          isShipTrackingEnabled={true}
          isWatchlistEnabled={false}
          onToggleLayerPanel={vi.fn()}
          onTogglePlayback={vi.fn()}
          onToggleSearch={vi.fn()}
          onTrackingModeChange={vi.fn()}
          onToggleWatchlist={vi.fn()}
          showAircraftControls={false}
          trackingMode="ship"
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Ships" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Toggle search panel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle watchlist panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle playback panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle layer settings" })).not.toBeInTheDocument();
  });
});
