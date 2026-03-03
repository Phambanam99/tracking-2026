import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Aircraft } from "../types/aircraftTypes";
import { useAircraftStore } from "../store/useAircraftStore";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";

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

import { AircraftMapLayer, shouldRenderAircraft } from "./AircraftMapLayer";

function buildAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao: "ABC123",
    lat: 10,
    lon: 106,
    lastSeen: 1700000000000,
    isMilitary: false,
    ...overrides,
  };
}

describe("AircraftMapLayer", () => {
  beforeEach(() => {
    mockMap.on = mockMapOn;
    mockMap.un = mockMapUn;
    mockMap.forEachFeatureAtPixel = mockForEachFeatureAtPixel;
    mockMap.getTargetElement = vi.fn().mockReturnValue(mockTargetElement);
    mockMap.addLayer = vi.fn();
    mockMap.removeLayer = vi.fn();
    mockTargetElement.style.cursor = "";

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    useAircraftStore.setState({
      aircraft: {},
      selectedIcao: null,
      detailIcao: null,
      trailIcao: null,
      trailPositions: [],
    });
    useWatchlistStore.setState((state) => ({
      ...state,
      groups: [],
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns true for all filter", () => {
    expect(shouldRenderAircraft(buildAircraft(), "all", new Set())).toBe(true);
  });

  test("returns true for watchlist filter when aircraft is in visible groups", () => {
    expect(shouldRenderAircraft(buildAircraft(), "watchlist", new Set(["abc123"]))).toBe(true);
  });

  test("returns false for watchlist filter when aircraft is not in visible groups", () => {
    expect(shouldRenderAircraft(buildAircraft(), "watchlist", new Set(["def456"]))).toBe(false);
  });

  test("returns true for military filter only when backend marks aircraft as military", () => {
    expect(shouldRenderAircraft(buildAircraft({ isMilitary: true }), "military", new Set())).toBe(true);
    expect(shouldRenderAircraft(buildAircraft(), "military", new Set())).toBe(false);
  });

  test("shows hover tooltip and updates cursor when pointer moves over an aircraft", async () => {
    const handlers = new Map<string, (event: { pixel: [number, number]; dragging?: boolean }) => void>();
    mockMapOn.mockImplementation((eventName: string, handler: (event: { pixel: [number, number] }) => void) => {
      handlers.set(eventName, handler);
    });

    useAircraftStore.setState({
      aircraft: {
        ABC123: buildAircraft({ callsign: "VN123" }),
      },
      selectedIcao: null,
      detailIcao: null,
      trailIcao: null,
      trailPositions: [],
    });

    mockForEachFeatureAtPixel.mockReturnValue({
      get: (key: string) => (key === "icao" ? "ABC123" : undefined),
    });

    render(createElement(AircraftMapLayer));

    await act(async () => {
      handlers.get("pointermove")?.({ pixel: [100, 140] });
      await Promise.resolve();
    });

    expect(mockTargetElement.style.cursor).toBe("pointer");
    expect(screen.getByTestId("aircraft-hover-tooltip")).toBeDefined();
    expect(screen.getByText("ABC123")).toBeDefined();
    expect(screen.getByText("VN123")).toBeDefined();
  });

  test("clears hover tooltip when pointer leaves aircraft", async () => {
    const handlers = new Map<string, (event: { pixel: [number, number]; dragging?: boolean }) => void>();
    mockMapOn.mockImplementation((eventName: string, handler: (event: { pixel: [number, number] }) => void) => {
      handlers.set(eventName, handler);
    });

    useAircraftStore.setState({
      aircraft: {
        ABC123: buildAircraft({ callsign: "VN123" }),
      },
      selectedIcao: null,
      detailIcao: null,
      trailIcao: null,
      trailPositions: [],
    });

    mockForEachFeatureAtPixel
      .mockReturnValueOnce({
        get: (key: string) => (key === "icao" ? "ABC123" : undefined),
      })
      .mockReturnValueOnce(undefined);

    render(createElement(AircraftMapLayer));

    await act(async () => {
      handlers.get("pointermove")?.({ pixel: [100, 140] });
      await Promise.resolve();
    });

    await act(async () => {
      handlers.get("pointermove")?.({ pixel: [120, 160] });
      await Promise.resolve();
    });

    expect(mockTargetElement.style.cursor).toBe("");
    expect(screen.queryByTestId("aircraft-hover-tooltip")).toBeNull();
  });
});
