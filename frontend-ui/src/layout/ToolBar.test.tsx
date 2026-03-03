import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../shared/i18n/I18nProvider";
import { ToolBar } from "./ToolBar";

describe("ToolBar", () => {
  test("fires shell toggle actions and base layer switches", () => {
    const onToggleSearch = vi.fn();
    const onToggleWatchlist = vi.fn();
    const onTogglePlayback = vi.fn();
    const onToggleLayerPanel = vi.fn();
    const onBaseLayerChange = vi.fn();
    const onTrackingModeChange = vi.fn();

    render(
      <I18nProvider defaultLanguage="en">
        <ToolBar
          activePanel={null}
          baseLayerType="osm"
          isLayerPanelOpen={false}
          isPlaybackOpen={false}
          isShipTrackingEnabled={true}
          isWatchlistEnabled={true}
          onBaseLayerChange={onBaseLayerChange}
          onToggleLayerPanel={onToggleLayerPanel}
          onTogglePlayback={onTogglePlayback}
          onToggleSearch={onToggleSearch}
          onToggleWatchlist={onToggleWatchlist}
          onTrackingModeChange={onTrackingModeChange}
          showAircraftControls={true}
          trackingMode="aircraft"
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByLabelText("Toggle search panel"));
    fireEvent.click(screen.getByLabelText("Toggle watchlist panel"));
    fireEvent.click(screen.getByLabelText("Toggle playback panel"));
    fireEvent.click(screen.getByLabelText("Toggle layer settings"));
    fireEvent.click(screen.getByRole("button", { name: "Ships" }));
    fireEvent.click(screen.getByRole("button", { name: "Sat" }));

    expect(onToggleSearch).toHaveBeenCalledTimes(1);
    expect(onToggleWatchlist).toHaveBeenCalledTimes(1);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onToggleLayerPanel).toHaveBeenCalledTimes(1);
    expect(onTrackingModeChange).toHaveBeenCalledWith("ship");
    expect(onBaseLayerChange).toHaveBeenCalledWith("satellite");
  });

  test("disables watchlist quick action when not authenticated", () => {
    render(
      <I18nProvider defaultLanguage="en">
        <ToolBar
          activePanel={null}
          baseLayerType="osm"
          isLayerPanelOpen={false}
          isPlaybackOpen={false}
          isShipTrackingEnabled={false}
          isWatchlistEnabled={false}
          onBaseLayerChange={vi.fn()}
          onToggleLayerPanel={vi.fn()}
          onTogglePlayback={vi.fn()}
          onToggleSearch={vi.fn()}
          onToggleWatchlist={vi.fn()}
          onTrackingModeChange={vi.fn()}
          showAircraftControls={true}
          trackingMode="aircraft"
        />
      </I18nProvider>,
    );

    expect(screen.getByLabelText("Toggle watchlist panel")).toBeDisabled();
  });

  test("hides aircraft-only controls in ship mode", () => {
    render(
      <I18nProvider defaultLanguage="en">
        <ToolBar
          activePanel={null}
          baseLayerType="osm"
          isLayerPanelOpen={false}
          isPlaybackOpen={false}
          isShipTrackingEnabled={true}
          isWatchlistEnabled={false}
          onBaseLayerChange={vi.fn()}
          onToggleLayerPanel={vi.fn()}
          onTogglePlayback={vi.fn()}
          onToggleSearch={vi.fn()}
          onToggleWatchlist={vi.fn()}
          onTrackingModeChange={vi.fn()}
          showAircraftControls={false}
          trackingMode="ship"
        />
      </I18nProvider>,
    );

    expect(screen.getByLabelText("Toggle search panel")).toBeInTheDocument();
    expect(screen.queryByLabelText("Toggle watchlist panel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Toggle playback panel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Toggle layer settings")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ships" })).toHaveAttribute("aria-pressed", "true");
  });
});
