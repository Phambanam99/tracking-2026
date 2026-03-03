import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePlaybackStore } from "../store/usePlaybackStore";
import { useAircraftStore } from "../../aircraft/store/useAircraftStore";

const {
  mockMap,
  mockMapOn,
  mockMapUn,
  mockForEachFeatureAtPixel,
  mockTargetElement,
} = vi.hoisted(() => {
  const targetElement = document.createElement("div");
  return {
    mockMapOn: vi.fn(),
    mockMapUn: vi.fn(),
    mockForEachFeatureAtPixel: vi.fn(),
    mockTargetElement: targetElement,
    mockMap: {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
      forEachFeatureAtPixel: vi.fn(),
      getTargetElement: vi.fn(),
    },
  };
});

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({ map: mockMap }),
}));

import { PlaybackMapLayer } from "./PlaybackMapLayer";

describe("PlaybackMapLayer", () => {
  beforeEach(() => {
    mockMap.on = mockMapOn;
    mockMap.un = mockMapUn;
    mockMap.forEachFeatureAtPixel = mockForEachFeatureAtPixel;
    mockMap.getTargetElement = vi.fn().mockReturnValue(mockTargetElement);
    mockMap.addLayer = vi.fn();
    mockMap.removeLayer = vi.fn();
    mockTargetElement.style.cursor = "";

    useAircraftStore.setState({
      aircraft: {},
      selectedIcao: null,
      detailIcao: null,
      trailIcao: null,
      trailPositions: [],
      trailPlaybackIndex: 0,
      isTrailPlaying: false,
      trailPlaybackSpeedMs: 600,
      trailRoutes: {},
      trailRouteOrder: [],
    });
    usePlaybackStore.setState({
      isDialogOpen: false,
      isBarVisible: true,
      isOpen: true,
      mode: "viewport",
      queryViewport: { north: 21, south: 20, east: 106, west: 105 },
      freezeViewport: true,
      timeFrom: "2026-03-02T10:00",
      timeTo: "2026-03-02T11:00",
      currentTime: "2026-03-02T10:00",
      currentFrameIndex: 0,
      speedMs: 1000,
      isPlaying: false,
      status: "ready",
      error: null,
      frames: [
        {
          timestamp: new Date("2026-03-02T10:00:00Z").getTime(),
          aircraft: [
            {
              icao: "AAA111",
              callsign: "AAA001",
              lat: 10,
              lon: 106,
              altitude: 10000,
              speed: 250,
              heading: 90,
              registration: null,
              aircraftType: "A320",
              operator: null,
              countryCode: "VN",
              countryFlagUrl: null,
              sourceId: null,
              eventTime: new Date("2026-03-02T10:00:00Z").getTime(),
              lastSeen: new Date("2026-03-02T10:00:00Z").getTime(),
              isMilitary: false,
            },
          ],
        },
      ],
      frameCount: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("does not write playback aircraft snapshots into the live aircraft store", async () => {
    render(createElement(PlaybackMapLayer));

    await act(async () => {
      await Promise.resolve();
    });

    expect(useAircraftStore.getState().aircraft["AAA111"]).toBeUndefined();
  });

  test("shows hover tooltip and selects playback aircraft on click", async () => {
    const handlers = new Map<string, (event: { pixel: [number, number]; dragging?: boolean }) => void>();
    mockMapOn.mockImplementation((eventName: string, handler: (event: { pixel: [number, number] }) => void) => {
      handlers.set(eventName, handler);
    });

    mockForEachFeatureAtPixel.mockReturnValue({
      get: (key: string) => (key === "icao" ? "AAA111" : undefined),
    });

    render(createElement(PlaybackMapLayer));

    await act(async () => {
      handlers.get("pointermove")?.({ pixel: [80, 120] });
      await Promise.resolve();
    });

    expect(mockTargetElement.style.cursor).toBe("pointer");
    expect(screen.getByTestId("playback-hover-tooltip")).toBeDefined();
    expect(screen.getByText("AAA111")).toBeDefined();

    await act(async () => {
      handlers.get("click")?.({ pixel: [80, 120] });
      await Promise.resolve();
    });

    expect(useAircraftStore.getState().selectedIcao).toBe("AAA111");
  });
});
