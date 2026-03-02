import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";

const {
  mockLoadTrail,
  mockMapOn,
  mockMapUn,
  mockGetPixelFromCoordinate,
} = vi.hoisted(() => ({
  mockLoadTrail: vi.fn().mockResolvedValue(undefined),
  mockMapOn: vi.fn(),
  mockMapUn: vi.fn(),
  mockGetPixelFromCoordinate: vi.fn().mockReturnValue([120, 80]),
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
    lastSeen: Date.now(),
    ...overrides,
  };
}

async function renderPopup(): Promise<void> {
  await act(async () => {
    render(<AircraftPopup />);
    await Promise.resolve();
  });
}

describe("AircraftPopup", () => {
  beforeEach(() => {
    useAircraftStore.setState({
      aircraft: {},
      selectedIcao: null,
      trailIcao: null,
      trailPositions: [],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    useAircraftStore.setState({
      aircraft: {},
      selectedIcao: null,
      trailIcao: null,
      trailPositions: [],
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

    expect(screen.getByText("VN123")).toBeDefined();
    expect(screen.getByText("VN-A321")).toBeDefined();
    expect(screen.getByText("A321")).toBeDefined();
    expect(screen.getByText("Vietnam Airlines")).toBeDefined();
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
    expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(1);
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
    fireEvent.click(screen.getByRole("button", { name: "3h" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Trail (3h)" }));

    expect(mockLoadTrail).toHaveBeenCalledWith("VN1234", 3);
  });

  test("shows clear trail action with the live point count", async () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        trailIcao: "VN1234",
        trailPositions: [
          { lat: 10.0, lon: 106.0, altitude: 10000, heading: 90, eventTime: 1 },
          { lat: 10.1, lon: 106.1, altitude: 11000, heading: 95, eventTime: 2 },
        ],
      });
    });

    await renderPopup();

    expect(screen.getByRole("button", { name: "Clear Trail (2 pts)" })).toBeDefined();
  });

  test("renders VN flag for VN country code", async () => {
    const aircraft = makeAircraft({ countryCode: "VN" });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByTestId("aircraft-popup").textContent).toContain("🇻🇳");
  });

  test("renders globe fallback for missing country code", async () => {
    const aircraft = makeAircraft({ countryCode: null });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getByTestId("aircraft-popup").textContent).toContain("🌐");
  });

  test("falls back to ICAO in the header when callsign and registration are missing", async () => {
    const aircraft = makeAircraft({ callsign: null, registration: null });
    act(() => {
      useAircraftStore.setState({ aircraft: { VN1234: aircraft }, selectedIcao: "VN1234" });
    });

    await renderPopup();
    expect(screen.getAllByText("VN1234").length).toBeGreaterThanOrEqual(2);
  });
});
