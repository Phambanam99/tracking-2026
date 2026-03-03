import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ToolBar } from "./ToolBar";

describe("ToolBar", () => {
  test("fires shell toggle actions and base layer switches", () => {
    const onToggleSearch = vi.fn();
    const onToggleWatchlist = vi.fn();
    const onTogglePlayback = vi.fn();
    const onToggleLayerPanel = vi.fn();
    const onBaseLayerChange = vi.fn();

    render(
      <ToolBar
        activePanel={null}
        baseLayerType="osm"
        isLayerPanelOpen={false}
        isPlaybackOpen={false}
        isWatchlistEnabled={true}
        onBaseLayerChange={onBaseLayerChange}
        onToggleLayerPanel={onToggleLayerPanel}
        onTogglePlayback={onTogglePlayback}
        onToggleSearch={onToggleSearch}
        onToggleWatchlist={onToggleWatchlist}
      />,
    );

    fireEvent.click(screen.getByLabelText("Toggle search panel"));
    fireEvent.click(screen.getByLabelText("Toggle watchlist panel"));
    fireEvent.click(screen.getByLabelText("Toggle playback panel"));
    fireEvent.click(screen.getByLabelText("Toggle layer settings"));
    fireEvent.click(screen.getByRole("button", { name: "Sat" }));

    expect(onToggleSearch).toHaveBeenCalledTimes(1);
    expect(onToggleWatchlist).toHaveBeenCalledTimes(1);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onToggleLayerPanel).toHaveBeenCalledTimes(1);
    expect(onBaseLayerChange).toHaveBeenCalledWith("satellite");
  });

  test("disables watchlist quick action when not authenticated", () => {
    render(
      <ToolBar
        activePanel={null}
        baseLayerType="osm"
        isLayerPanelOpen={false}
        isPlaybackOpen={false}
        isWatchlistEnabled={false}
        onBaseLayerChange={vi.fn()}
        onToggleLayerPanel={vi.fn()}
        onTogglePlayback={vi.fn()}
        onToggleSearch={vi.fn()}
        onToggleWatchlist={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Toggle watchlist panel")).toBeDisabled();
  });
});
