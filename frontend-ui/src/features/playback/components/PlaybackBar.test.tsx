import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { usePlaybackStore } from "../store/usePlaybackStore";

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({
    map: {
      getView: () => ({
        set: vi.fn(),
        getZoom: vi.fn(() => 6),
        animate: vi.fn(),
      }),
    },
  }),
}));

vi.mock("../../map/hooks/useMapViewport", () => ({
  useMapViewport: () => null,
}));

import { PlaybackBar } from "./PlaybackBar";

describe("PlaybackBar keyboard shortcuts", () => {
  beforeEach(() => {
    act(() => {
      usePlaybackStore.setState({
        isDialogOpen: false,
        isBarVisible: true,
        isOpen: true,
        mode: "viewport",
        queryViewport: null,
        freezeViewport: true,
        timeFrom: "2026-03-02T10:00",
        timeTo: "2026-03-02T11:00",
        currentTime: "2026-03-02T10:00",
        currentFrameIndex: 1,
        speedMs: 50,
        speedMultiplier: 300,
        timelineZoomLevel: 1,
        frameIntervalMs: 15_000,
        isPlaying: false,
        status: "ready",
        error: null,
        frameCount: 3,
        frames: [
          { timestamp: new Date("2026-03-02T10:00:00Z").getTime(), aircraft: [] },
          { timestamp: new Date("2026-03-02T10:15:00Z").getTime(), aircraft: [] },
          { timestamp: new Date("2026-03-02T10:30:00Z").getTime(), aircraft: [] },
        ],
      });
    });
  });

  test("space toggles play/pause and escape closes bar", () => {
    render(<PlaybackBar />);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(usePlaybackStore.getState().isPlaying).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(usePlaybackStore.getState().isBarVisible).toBe(false);
  });

  test("arrow/home/end shortcuts move timeline", () => {
    render(<PlaybackBar />);

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(usePlaybackStore.getState().currentFrameIndex).toBe(0);

    fireEvent.keyDown(window, { key: "End" });
    expect(usePlaybackStore.getState().currentFrameIndex).toBe(2);

    fireEvent.keyDown(window, { key: "Home" });
    expect(usePlaybackStore.getState().currentFrameIndex).toBe(0);
  });

  test("plus/minus adjust speed and ctrl+plus adjusts zoom", () => {
    render(<PlaybackBar />);

    fireEvent.keyDown(window, { key: "+" });
    expect(usePlaybackStore.getState().speedMultiplier).toBe(500);

    fireEvent.keyDown(window, { key: "-" });
    expect(usePlaybackStore.getState().speedMultiplier).toBe(300);

    fireEvent.keyDown(window, { key: "=", ctrlKey: true });
    expect(usePlaybackStore.getState().timelineZoomLevel).toBe(1.5);
  });

  test("render includes select date action", () => {
    render(<PlaybackBar />);
    expect(screen.getByRole("button", { name: "Select Date" })).toBeInTheDocument();
  });
});
