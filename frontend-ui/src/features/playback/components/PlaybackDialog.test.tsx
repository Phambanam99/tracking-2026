import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { usePlaybackStore } from "../store/usePlaybackStore";

vi.mock("../../map/hooks/useMapViewport", () => ({
  useMapViewport: () => ({
    north: 20,
    south: 10,
    east: 110,
    west: 100,
  }),
}));

vi.mock("../api/playbackApi", () => ({
  fetchViewportPlaybackEvents: vi.fn(),
}));

vi.mock("../utils/buildPlaybackFrames", () => ({
  buildPlaybackFrames: vi.fn(),
}));

import { PlaybackDialog } from "./PlaybackDialog";

describe("PlaybackDialog", () => {
  test("renders close button and closes dialog without a secondary hint button", () => {
    act(() => {
      usePlaybackStore.setState({
        isDialogOpen: true,
        isBarVisible: false,
        isOpen: true,
        mode: "viewport",
        queryViewport: null,
        freezeViewport: true,
        timeFrom: "2026-03-03T09:00",
        timeTo: "2026-03-03T10:00",
        currentTime: "2026-03-03T09:00",
        currentFrameIndex: 0,
        speedMs: 50,
        speedMultiplier: 300,
        timelineZoomLevel: 1,
        frameIntervalMs: 15000,
        isPlaying: false,
        status: "idle",
        error: null,
        frames: [],
        frameCount: 0,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <PlaybackDialog />
      </I18nProvider>,
    );

    const closeButton = screen.getByRole("button", { name: "Close playback dialog" });
    expect(closeButton.textContent).toBe("x");
    expect(screen.queryByRole("button", { name: "Adjust time range before loading" })).toBeNull();

    fireEvent.click(closeButton);

    expect(usePlaybackStore.getState().isDialogOpen).toBe(false);
  });
});
