import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { DEFAULT_SHIP_TRAIL_WINDOW_MS, useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

const { getAllShipHistoryMock } = vi.hoisted(() => ({
  getAllShipHistoryMock: vi.fn(),
}));

vi.mock("../api/shipSearchApi", () => ({
  getAllShipHistory: getAllShipHistoryMock,
}));

import { ShipDetailPanel } from "./ShipDetailPanel";

describe("ShipDetailPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    getAllShipHistoryMock.mockReset();
    act(() => {
      useShipStore.setState({
        ships: {},
        selectedMmsi: null,
        detailMmsi: null,
        selectedMode: null,
        detailMode: null,
        activeTrailRouteKey: null,
        trailRoutes: {},
        trailRouteOrder: [],
        trailMmsi: null,
        trailAnchorTime: null,
        trailPoints: [],
        trailRangeFrom: null,
        trailRangeTo: null,
        trailStatus: "idle",
        trailError: null,
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
      useTrackedShipStore.setState({
        groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
        activeGroupId: "default",
        trackedMmsis: {},
      });
    });
  });

  afterEach(() => {
    act(() => {
      useShipStore.setState({
        ships: {},
        selectedMmsi: null,
        detailMmsi: null,
        selectedMode: null,
        detailMode: null,
        activeTrailRouteKey: null,
        trailRoutes: {},
        trailRouteOrder: [],
        trailMmsi: null,
        trailAnchorTime: null,
        trailPoints: [],
        trailRangeFrom: null,
        trailRangeTo: null,
        trailStatus: "idle",
        trailError: null,
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
      useTrackedShipStore.setState({
        groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
        activeGroupId: "default",
        trackedMmsis: {},
      });
    });
  });

  test("renders ship details in overview tab", () => {
    act(() => {
      useShipStore.setState({
        ships: {
          "574001230": {
            mmsi: "574001230",
            lat: 10,
            lon: 106,
            speed: 12,
            course: 180,
            heading: 181,
            navStatus: "under_way_using_engine",
            vesselName: "PACIFIC TRADER",
            vesselType: "cargo",
            imo: "9876543",
            callSign: "3WAB2",
            destination: "SG SIN",
            eta: null,
            eventTime: 100,
            sourceId: "AIS",
            isHistorical: false,
            metadata: { flagCountry: "Vietnam", shipTypeName: "Cargo Vessel", isMilitary: true },
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: "574001230",
        detailMode: "history",
        activeTrailRouteKey: "574001230:100",
        trailRoutes: {
          "574001230:100": {
            key: "574001230:100",
            mmsi: "574001230",
            anchorTime: 100,
            points: [
              { lat: 9.8, lon: 105.8, eventTime: 50, speed: 11, course: 170, heading: 171, sourceId: "AIS" },
              { lat: 10, lon: 106, eventTime: 100, speed: 12, course: 180, heading: 181, sourceId: "AIS" },
            ],
            rangeFrom: 0,
            rangeTo: 100,
            status: "ready",
            error: null,
            color: "#818cf8",
          },
        },
        trailRouteOrder: ["574001230:100"],
        trailMmsi: "574001230",
        trailAnchorTime: 100,
        trailPoints: [
          { lat: 9.8, lon: 105.8, eventTime: 50, speed: 11, course: 170, heading: 171, sourceId: "AIS" },
          { lat: 10, lon: 106, eventTime: 100, speed: 12, course: 180, heading: 181, sourceId: "AIS" },
        ],
        trailRangeFrom: 0,
        trailRangeTo: 100,
        trailStatus: "ready",
        trailError: null,
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipDetailPanel />
      </I18nProvider>,
    );

    expect(screen.getByText("Ship Detail")).toBeDefined();
    expect(screen.getByText("Overview")).toBeDefined();
    expect(screen.getByText("History")).toBeDefined();
    expect(screen.getByText("9876543")).toBeDefined();
    expect(screen.queryByText("History preview")).not.toBeInTheDocument();
  });

  test("overview no longer renders trail window presets", () => {
    act(() => {
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
            eventTime: 100,
            sourceId: "AIS",
            isHistorical: true,
            metadata: null,
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: "574001230",
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipDetailPanel />
      </I18nProvider>,
    );

    expect(screen.queryByRole("button", { name: "Set ship trail window to 30m" })).not.toBeInTheDocument();
  });

  test("loads segmented voyage history when opening history tab", async () => {
    getAllShipHistoryMock.mockResolvedValue([
      { mmsi: "574001230", lat: 10, lon: 106, speed: null, course: null, heading: null, navStatus: null, eventTime: 1_000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 10.1, lon: 106.1, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 11, lon: 107, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000 + 2 * 24 * 60 * 60 * 1000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 11.1, lon: 107.1, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000 + 2 * 24 * 60 * 60 * 1000 + 60_000, sourceId: "AIS" },
    ]);

    act(() => {
      useShipStore.setState({
        ships: {
          "574001230": {
            mmsi: "574001230",
            lat: 10,
            lon: 106,
            speed: null,
            course: null,
            heading: null,
            navStatus: null,
            vesselName: "PACIFIC TRADER",
            vesselType: "cargo",
            imo: null,
            callSign: null,
            destination: null,
            eta: null,
            eventTime: 100,
            sourceId: "AIS",
            isHistorical: false,
            metadata: null,
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: "574001230",
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipDetailPanel />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => expect(getAllShipHistoryMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Voyage history")).toBeDefined();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Show route" }).length).toBe(2));
    expect(screen.getAllByText((_, element) => element?.tagName === "P" && element.textContent === "Voyage 2").length).toBe(1);
    expect(screen.getAllByText((_, element) => element?.tagName === "P" && element.textContent === "Voyage 1").length).toBe(1);
  });

  test("tracks ship from detail panel", () => {
    act(() => {
      useShipStore.setState({
        ships: {
          "574001230": {
            mmsi: "574001230",
            lat: 10,
            lon: 106,
            speed: null,
            course: null,
            heading: null,
            navStatus: null,
            vesselName: "PACIFIC TRADER",
            vesselType: "cargo",
            imo: null,
            callSign: null,
            destination: null,
            eta: null,
            eventTime: 100,
            sourceId: "AIS",
            isHistorical: false,
            metadata: null,
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: "574001230",
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
      useTrackedShipStore.setState({
        groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
        activeGroupId: "default",
        trackedMmsis: {},
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipDetailPanel />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Track ship" }));
    expect(useTrackedShipStore.getState().isTracked("574001230")).toBe(true);
  });

  test("closes on swipe-down on mobile", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    act(() => {
      useShipStore.setState({
        ships: {
          "574001230": {
            mmsi: "574001230",
            lat: 10,
            lon: 106,
            speed: null,
            course: null,
            heading: null,
            navStatus: null,
            vesselName: "PACIFIC TRADER",
            vesselType: "cargo",
            imo: null,
            callSign: null,
            destination: null,
            eta: null,
            eventTime: 100,
            sourceId: "AIS",
            isHistorical: false,
            metadata: null,
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: "574001230",
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipDetailPanel />
      </I18nProvider>,
    );

    fireEvent.touchStart(screen.getByText("Ship Detail").closest("section")!, {
      touches: [{ clientX: 20, clientY: 40 }],
    });
    fireEvent.touchEnd(screen.getByText("Ship Detail").closest("section")!, {
      changedTouches: [{ clientX: 24, clientY: 140 }],
    });

    expect(useShipStore.getState().detailMmsi).toBeNull();
  });
});
