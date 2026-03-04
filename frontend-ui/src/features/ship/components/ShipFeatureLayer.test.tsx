import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_SHIP_TRAIL_WINDOW_MS, useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

const { mockFit, mockAnimate, mockMap, shipLayerState } = vi.hoisted(() => {
  const fit = vi.fn();
  const animate = vi.fn();
  return {
    mockFit: fit,
    mockAnimate: animate,
    mockMap: {
      getView: vi.fn(() => ({
        animate,
        fit,
      })),
    },
    shipLayerState: { followSelected: false, trackedOnly: false, trackedGroupFilterIds: [] as string[] },
  };
});

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({ map: mockMap, mapContainerEl: null }),
}));

vi.mock("../../map/hooks/useMapViewport", () => ({
  useMapViewport: () => null,
}));

vi.mock("../../map/hooks/useShipSocket", () => ({
  useShipSocket: vi.fn(),
}));

const useShipViewportSnapshot = vi.fn();

vi.mock("../hooks/useShipViewportSnapshot", () => ({
  useShipViewportSnapshot: (...args: unknown[]) => useShipViewportSnapshot(...args),
}));

vi.mock("../store/useShipLayerStore", () => ({
  useShipLayerStore: (selector: (state: { followSelected: boolean; trackedOnly: boolean; trackedGroupFilterIds: string[] }) => unknown) =>
    selector(shipLayerState),
}));

vi.mock("../../auth/store/useAuthStore", () => ({
  useAuthStore: (selector: (state: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: null }),
}));

const { getShipHistoryMock, searchShipGlobalMock } = vi.hoisted(() => ({
  getShipHistoryMock: vi.fn(),
  searchShipGlobalMock: vi.fn(),
}));

vi.mock("../api/shipSearchApi", () => ({
  getShipHistory: getShipHistoryMock,
  searchShipGlobal: searchShipGlobalMock,
}));

vi.mock("./ShipMapLayer", () => ({
  ShipMapLayer: () => null,
}));

vi.mock("./ShipPopup", () => ({
  ShipPopup: () => null,
}));

vi.mock("./ShipDetailPanel", () => ({
  ShipDetailPanel: () => null,
}));

import { ShipFeatureLayer } from "./ShipFeatureLayer";

describe("ShipFeatureLayer", () => {
  beforeEach(() => {
    mockFit.mockReset();
    mockAnimate.mockReset();
    useShipViewportSnapshot.mockReset();
    shipLayerState.followSelected = false;
    shipLayerState.trackedOnly = false;
    shipLayerState.trackedGroupFilterIds = [];
    searchShipGlobalMock.mockReset();
    getShipHistoryMock.mockReset();
    searchShipGlobalMock.mockResolvedValue({ results: [], total: 0, truncated: false });
    getShipHistoryMock.mockResolvedValue([]);
    useTrackedShipStore.setState({
      groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
      activeGroupId: "default",
      trackedMmsis: {},
    });
    useShipStore.setState({
      ships: {
        "574001230": {
          mmsi: "574001230",
          lat: 10,
          lon: 106,
          speed: 12,
          course: 180,
          heading: 181,
          navStatus: null,
          vesselName: "PACIFIC TRADER",
          vesselType: "cargo",
          imo: null,
          callSign: null,
          destination: null,
          eta: null,
          eventTime: 1_700_000_100_000,
          sourceId: "AIS",
          isHistorical: true,
          metadata: null,
          lastSeen: Date.now(),
        },
      },
      selectedMmsi: "574001230",
      detailMmsi: "574001230",
      selectedMode: "history",
      detailMode: "history",
      activeTrailRouteKey: "574001230:1700000100000",
      trailRoutes: {
        "574001230:1700000100000": {
          key: "574001230:1700000100000",
          mmsi: "574001230",
          anchorTime: 1_700_000_100_000,
          points: [
            { lat: 9.8, lon: 105.8, eventTime: 1_700_000_000_000, speed: 11, course: 170, heading: 171, sourceId: "AIS" },
            { lat: 10, lon: 106, eventTime: 1_700_000_100_000, speed: 12, course: 180, heading: 181, sourceId: "AIS" },
          ],
          rangeFrom: 1_699_999_000_000,
          rangeTo: 1_700_000_400_000,
          status: "ready",
          error: null,
          color: "#818cf8",
        },
      },
      trailRouteOrder: ["574001230:1700000100000"],
      trailMmsi: "574001230",
      trailAnchorTime: 1_700_000_100_000,
      trailPoints: [
        { lat: 9.8, lon: 105.8, eventTime: 1_700_000_000_000, speed: 11, course: 170, heading: 171, sourceId: "AIS" },
        { lat: 10, lon: 106, eventTime: 1_700_000_100_000, speed: 12, course: 180, heading: 181, sourceId: "AIS" },
      ],
      trailRangeFrom: 1_699_999_000_000,
      trailRangeTo: 1_700_000_400_000,
      trailStatus: "ready",
      trailError: null,
      trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
    });
  });

  test("auto-fits map to ready history trail", () => {
    render(<ShipFeatureLayer />);

    expect(mockFit).toHaveBeenCalledTimes(1);
    expect(useShipViewportSnapshot).toHaveBeenCalled();
    expect(mockFit.mock.calls[0]?.[1]).toMatchObject({
      duration: 400,
      maxZoom: 11,
      padding: [56, 56, 56, 320],
    });
  });

  test("does not auto-fit live selection without historical trail context", () => {
    useShipStore.setState({
      selectedMode: "viewport",
      detailMode: "viewport",
    });

    render(<ShipFeatureLayer />);

    expect(mockFit).not.toHaveBeenCalled();
  });

  test("follows selected ship when follow mode is enabled", () => {
    shipLayerState.followSelected = true;

    render(<ShipFeatureLayer />);

    expect(mockAnimate).toHaveBeenCalledTimes(1);
    expect(mockAnimate.mock.calls[0]?.[0]).toMatchObject({
      duration: 320,
    });
  });

  test("hydrates tracked missing ships from global search first", async () => {
    shipLayerState.trackedOnly = true;
    shipLayerState.trackedGroupFilterIds = [];
    useShipStore.setState({
      ships: {},
      selectedMmsi: null,
      detailMmsi: null,
      selectedMode: null,
      detailMode: null,
    });
    useTrackedShipStore.setState({
      groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: ["413387870"], visibleOnMap: true }],
      activeGroupId: "default",
      trackedMmsis: { "413387870": true },
    });

    searchShipGlobalMock.mockResolvedValue({
      results: [
        {
          mmsi: "413387870",
          lat: 19,
          lon: 108.6,
          speed: 9,
          course: 120,
          heading: 122,
          eventTime: 1_700_000_300_000,
          sourceId: "service-query",
          vesselName: "FU TENG",
          vesselType: "cargo",
          navStatus: null,
          isMilitary: false,
        },
      ],
      total: 1,
      truncated: false,
    });

    render(<ShipFeatureLayer />);

    await waitFor(() => expect(searchShipGlobalMock).toHaveBeenCalledWith("413387870"));
    expect(getShipHistoryMock).not.toHaveBeenCalled();
    await waitFor(() => expect(useShipStore.getState().ships["413387870"]?.lat).toBe(19));
  });

  test("falls back to history when global search has no exact MMSI", async () => {
    shipLayerState.trackedOnly = true;
    shipLayerState.trackedGroupFilterIds = [];
    useShipStore.setState({
      ships: {},
      selectedMmsi: null,
      detailMmsi: null,
      selectedMode: null,
      detailMode: null,
    });
    useTrackedShipStore.setState({
      groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: ["413387870"], visibleOnMap: true }],
      activeGroupId: "default",
      trackedMmsis: { "413387870": true },
    });

    searchShipGlobalMock.mockResolvedValue({
      results: [
        {
          mmsi: "999999999",
          lat: 1,
          lon: 2,
          speed: 3,
          course: 4,
          heading: 5,
          eventTime: 1_700_000_000_000,
          sourceId: "service-query",
          vesselName: "OTHER",
          vesselType: "cargo",
          navStatus: null,
          isMilitary: false,
        },
      ],
      total: 1,
      truncated: false,
    });
    getShipHistoryMock.mockResolvedValue([
      {
        mmsi: "413387870",
        lat: 18,
        lon: 108,
        speed: null,
        course: null,
        heading: null,
        navStatus: null,
        eventTime: 1_700_000_100_000,
        sourceId: "AIS",
      },
    ]);

    render(<ShipFeatureLayer />);

    await waitFor(() => expect(searchShipGlobalMock).toHaveBeenCalledWith("413387870"));
    await waitFor(() => expect(getShipHistoryMock).toHaveBeenCalled());
    await waitFor(() => expect(useShipStore.getState().ships["413387870"]?.lat).toBe(18));
  });
});
