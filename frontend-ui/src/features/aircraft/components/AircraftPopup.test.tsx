import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearAuthSession, setAuthTokens } from "../../auth/store/useAuthStore";
import { usePlaybackStore } from "../../playback/store/usePlaybackStore";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";

const {
  mockLoadTrail,
  mockMapOn,
  mockMapUn,
  mockGetPixelFromCoordinate,
  mockViewAnimate,
  mockViewGetZoom,
} = vi.hoisted(() => ({
  mockLoadTrail: vi.fn().mockResolvedValue(undefined),
  mockMapOn: vi.fn(),
  mockMapUn: vi.fn(),
  mockGetPixelFromCoordinate: vi.fn().mockReturnValue([120, 80]),
  mockViewAnimate: vi.fn(),
  mockViewGetZoom: vi.fn().mockReturnValue(6),
}));

vi.mock("ol/proj", () => ({
  fromLonLat: vi.fn().mockImplementation((coordinates: number[]) => coordinates),
}));

vi.mock("../hooks/useFlightHistory", () => ({
  useFlightHistory: () => ({
    isLoading: false,
    error: null,
    loadTrail: mockLoadTrail,
  }),
}));

const mockMapContainerEl = {
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    right: 400,
    bottom: 300,
    width: 400,
    height: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
} as HTMLDivElement;

const mockMap = {
  on: mockMapOn,
  un: mockMapUn,
  getPixelFromCoordinate: mockGetPixelFromCoordinate,
  getView: () => ({
    animate: mockViewAnimate,
    getZoom: mockViewGetZoom,
  }),
};

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({ map: mockMap, mapContainerEl: mockMapContainerEl }),
}));

import { AircraftPopup } from "./AircraftPopup";

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao: "VN1234",
    callsign: "VN123",
    lat: 10.0,
    lon: 106.0,
    altitude: 35000,
    speed: 450,
    heading: 270,
    registration: "VN-A321",
    aircraftType: "A321",
    operator: "Vietnam Airlines",
    countryCode: "VN",
    isMilitary: false,
    lastSeen: Date.now(),
    ...overrides,
  };
}

async function renderPopup(): Promise<void> {
  await act(async () => {
    render(
      <I18nProvider defaultLanguage="en">
        <AircraftPopup />
      </I18nProvider>,
    );
    await Promise.resolve();
  });
}

describe("AircraftPopup", () => {
  beforeEach(() => {
    act(() => {
      clearAuthSession();
    });
    act(() => {
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
        isOpen: false,
        mode: "viewport",
        queryViewport: null,
        freezeViewport: true,
        timeFrom: "2026-03-02T10:00",
        timeTo: "2026-03-02T11:00",
        currentTime: "2026-03-02T10:00",
        currentFrameIndex: 0,
        speedMs: 1000,
        isPlaying: false,
        status: "idle",
        error: null,
        frames: [],
        frameCount: 0,
      });
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      clearAuthSession();
    });
    act(() => {
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
        isOpen: false,
        mode: "viewport",
        queryViewport: null,
        freezeViewport: true,
        timeFrom: "2026-03-02T10:00",
        timeTo: "2026-03-02T11:00",
        currentTime: "2026-03-02T10:00",
        currentFrameIndex: 0,
        speedMs: 1000,
        isPlaying: false,
        status: "idle",
        error: null,
        frames: [],
        frameCount: 0,
      });
    });
  });

  test("renders popup and connector containers", async () => {
    await renderPopup();
    expect(screen.getByTestId("aircraft-popup")).toBeDefined();
    expect(screen.getByTestId("aircraft-popup-connector")).toBeDefined();
  });

  test("popup content is hidden when nothing is selected", async () => {
    await renderPopup();
    expect(screen.queryByText("VN123")).toBeNull();
  });

  test("renders aircraft details when an aircraft is selected", async () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
      });
    });

    await renderPopup();

    expect(screen.getByText("Callsign VN123")).toBeDefined();
    expect(screen.getAllByText("VN-A321").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("A321").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Vietnam Airlines").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("VN1234")).toBeDefined();
  });

  test("renders altitude correctly formatted", async () => {
    const aircraft = makeAircraft({ altitude: 35000 });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByText(/35.*ft/)).toBeDefined();
  });

  test("renders Ground for zero altitude", async () => {
    const aircraft = makeAircraft({ altitude: 0 });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByText("Ground")).toBeDefined();
  });

  test("renders dash for null altitude", async () => {
    const aircraft = makeAircraft({ altitude: null });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  test("close button deselects the aircraft", async () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    fireEvent.click(screen.getByLabelText("Close popup"));

    expect(useAircraftStore.getState().selectedIcao).toBeNull();
  });

  test("renders a connector line and subscribes to postrender updates", async () => {
    const aircraft = makeAircraft({ lat: 10.5, lon: 106.5 });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();

    expect(mockMapOn).toHaveBeenCalledWith("postrender", expect.any(Function));
    expect(screen.getByTestId("aircraft-popup-connector").querySelector("line")).not.toBeNull();
  });

  test("show trail loads history for the selected aircraft with the chosen duration", async () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    fireEvent.change(screen.getByLabelText("Trail hours"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Show Trail (3h)" }));

    expect(mockLoadTrail).toHaveBeenCalledWith("VN1234", 3);
  });

  test("shows clear trail action with the live point count", async () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        trailRoutes: {
          VN1234: {
            icao: "VN1234",
            positions: [
              { lat: 10.0, lon: 106.0, altitude: 10000, heading: 90, eventTime: 1 },
              { lat: 10.1, lon: 106.1, altitude: 11000, heading: 95, eventTime: 2 },
            ],
            color: "#22d3ee",
          },
        },
        trailRouteOrder: ["VN1234"],
        trailIcao: "VN1234",
        trailPositions: [
          { lat: 10.0, lon: 106.0, altitude: 10000, heading: 90, eventTime: 1 },
          { lat: 10.1, lon: 106.1, altitude: 11000, heading: 95, eventTime: 2 },
        ],
        trailPlaybackIndex: 1,
        isTrailPlaying: false,
      });
    });

    await renderPopup();

    expect(screen.getByRole("button", { name: "Clear Trail (2 pts)" })).toBeDefined();
  });

  test("does not render playback controls inside the popup anymore", async () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        trailRoutes: {
          VN1234: {
            icao: "VN1234",
            positions: [
              { lat: 10.0, lon: 106.0, altitude: 10000, heading: 90, eventTime: 1 },
              { lat: 10.1, lon: 106.1, altitude: 11000, heading: 95, eventTime: 2 },
            ],
            color: "#22d3ee",
          },
        },
        trailRouteOrder: ["VN1234"],
        trailIcao: "VN1234",
        trailPositions: [
          { lat: 10.0, lon: 106.0, altitude: 10000, heading: 90, eventTime: 1 },
          { lat: 10.1, lon: 106.1, altitude: 11000, heading: 95, eventTime: 2 },
        ],
        trailPlaybackIndex: 1,
        isTrailPlaying: false,
      });
    });

    await renderPopup();

    expect(screen.queryByLabelText("Trail playback position")).toBeNull();
    expect(screen.queryByText("Route Summary")).toBeNull();
  });

  test("renders country flag images when available", async () => {
    const aircraft = makeAircraft({
      countryCode: "VN",
      countryFlagUrl: "https://flagcdn.com/h80/vn.png",
    });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getAllByRole("img", { name: "VN flag" })).toHaveLength(2);
  });

  test("renders formatted position coordinates", async () => {
    const aircraft = makeAircraft({ lat: 10.12345, lon: 106.98765 });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByText("10.1235°N 106.9877°E")).toBeDefined();
  });

  test("renders globe fallback text for missing country code", async () => {
    const aircraft = makeAircraft({ countryCode: null });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByText("Globe")).toBeDefined();
  });

  test("renders follow action for authenticated users", async () => {
    act(() => {
      setAuthTokens("test-token", "refresh-token");
    });
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByRole("button", { name: "Follow" })).toBeDefined();
  });

  test("falls back to ICAO in the header when callsign and registration are missing", async () => {
    const aircraft = makeAircraft({ callsign: null, registration: null });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getAllByText("VN1234").length).toBeGreaterThanOrEqual(2);
  });

  test("renders military badges when aircraft is marked military", async () => {
    const aircraft = makeAircraft({ isMilitary: true });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();

    expect(screen.getAllByText("Military")).toHaveLength(2);
  });

  test("backfills missing popup metadata from aircraft db shards", async () => {
    const aircraft = makeAircraft({
      icao: "F00DBA",
      callsign: null,
      registration: null,
      aircraftType: null,
      operator: null,
      countryCode: null,
      countryFlagUrl: null,
    });
    act(() => {
      useAircraftStore.setState({ aircraft: { F00DBA: aircraft }, selectedIcao: "F00DBA" });
    });

    await renderPopup();

    expect((await screen.findAllByText("Seed Demo Air")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("N42DB")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByRole("img", { name: "US flag" })).length).toBeGreaterThanOrEqual(1);
  });

  test("shows playback snapshot context and focuses the aircraft on map", async () => {
    const aircraft = makeAircraft({
      icao: "AAA111",
      eventTime: new Date("2026-03-02T10:00:25Z").getTime(),
    });
    act(() => {
      useAircraftStore.setState({ aircraft: {}, selectedIcao: "AAA111" });
      usePlaybackStore.setState({
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
            timestamp: new Date("2026-03-02T10:00:25Z").getTime(),
            aircraft: [aircraft],
          },
        ],
        frameCount: 1,
      });
    });

    await renderPopup();

    expect(screen.getByText("Playback Snapshot")).toBeDefined();
    expect(screen.getByText(/Viewport playback/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Focus On Map" }));

    expect(mockViewAnimate).toHaveBeenCalledTimes(1);
  });

  test("does not fall back to stale live aircraft data while playback is active", async () => {
    const liveAircraft = makeAircraft({ icao: "AAA111", callsign: "LIVE111" });
    act(() => {
      useAircraftStore.setState({ aircraft: { AAA111: liveAircraft }, selectedIcao: "AAA111" });
      usePlaybackStore.setState({
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
            timestamp: new Date("2026-03-02T10:00:25Z").getTime(),
            aircraft: [],
          },
        ],
        frameCount: 1,
      });
    });

    await renderPopup();

    expect(screen.queryByText("LIVE111")).toBeNull();
  });
});
