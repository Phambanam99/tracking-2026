import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { DEFAULT_SHIP_TRAIL_WINDOW_MS, useShipStore } from "../store/useShipStore";
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
    act(() => {
      useShipStore.setState({
        ships: {},
        selectedMmsi: null,
        detailMmsi: null,
        selectedMode: null,
        detailMode: null,
        trailMmsi: null,
        trailAnchorTime: null,
        trailPoints: [],
        trailRangeFrom: null,
        trailRangeTo: null,
        trailStatus: "idle",
        trailError: null,
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
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
        trailMmsi: null,
        trailAnchorTime: null,
        trailPoints: [],
        trailRangeFrom: null,
        trailRangeTo: null,
        trailStatus: "idle",
        trailError: null,
        trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
      });
    });
  });

  test("renders ship details", () => {
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
    expect(screen.getByText("9876543")).toBeDefined();
    expect(screen.getAllByText("Military").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("History preview")).toBeDefined();
    expect(screen.getByRole("button", { name: "Set ship trail window to 30m" })).toBeDefined();
  });

  test("changes trail window preset", () => {
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
        detailMode: "history",
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

    fireEvent.click(screen.getByRole("button", { name: "Set ship trail window to 30m" }));
    expect(useShipStore.getState().trailWindowMs).toBe(1_800_000);
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
