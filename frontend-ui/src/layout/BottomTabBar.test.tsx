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

    render(
      <I18nProvider defaultLanguage="en">
        <BottomTabBar
          activePanel="search"
          isLayerPanelOpen={false}
          isPlaybackOpen={false}
          isWatchlistEnabled={false}
          onToggleLayerPanel={onToggleLayerPanel}
          onTogglePlayback={onTogglePlayback}
          onToggleSearch={onToggleSearch}
          onToggleWatchlist={onToggleWatchlist}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle search panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle playback panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle layer settings" }));

    expect(onToggleSearch).toHaveBeenCalledTimes(1);
    expect(onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(onToggleLayerPanel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Toggle watchlist panel" })).toBeDisabled();
  });
});
