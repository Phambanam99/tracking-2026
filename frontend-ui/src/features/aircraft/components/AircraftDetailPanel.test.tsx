import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";

const mockUseAircraftPhoto = vi.fn(() => ({
  imageUrl: null,
  isLoading: false,
  source: null,
}));

const mockUseAircraftPhotoMetadata = vi.fn(() => ({
  metadata: null,
  isLoading: false,
}));

vi.mock("../hooks/useAircraftPhoto", () => ({
  useAircraftPhoto: (...args: unknown[]) => mockUseAircraftPhoto(...args),
}));

vi.mock("../hooks/useAircraftPhotoMetadata", () => ({
  useAircraftPhotoMetadata: (...args: unknown[]) => mockUseAircraftPhotoMetadata(...args),
}));

import { AircraftDetailPanel } from "./AircraftDetailPanel";

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao: "VN1234",
    callsign: "VN123",
    lat: 10.0,
    lon: 106.0,
    altitude: 35000,
    speed: 450,
    heading: 270,
    eventTime: 1700000000000,
    sourceId: "RADARBOX-GLOBAL",
    registration: "VN-A321",
    aircraftType: "A321",
    operator: "Vietnam Airlines",
    countryCode: "VN",
    isMilitary: false,
    lastSeen: Date.now(),
    countryFlagUrl: "https://flagcdn.com/h80/vn.png",
    ...overrides,
  };
}

describe("AircraftDetailPanel", () => {
  beforeEach(() => {
    useAircraftStore.setState({ aircraft: {}, selectedIcao: null, detailIcao: null });
    vi.clearAllMocks();
    mockUseAircraftPhoto.mockReturnValue({
      imageUrl: "blob:aircraft-photo",
      isLoading: false,
      source: "local",
    });
    mockUseAircraftPhotoMetadata.mockReturnValue({
      metadata: {
        icao: "VN1234",
        cacheHit: true,
        sourceUrl: "https://cdn.planespotters.net/photo/test.jpg",
        cachedAt: "2026-03-02T07:00:00Z",
        contentType: "image/jpeg",
        localPhotoUrl: "/api/v1/aircraft/VN1234/photo/local",
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    useAircraftStore.setState({ aircraft: {}, selectedIcao: null, detailIcao: null });
  });

  test("renders cache badge and debug links", () => {
    const aircraft = makeAircraft();
    useAircraftStore.setState({
      aircraft: { VN1234: aircraft },
      selectedIcao: "VN1234",
      detailIcao: "VN1234",
    });

    render(<AircraftDetailPanel />);

    expect(screen.getByText("Local cache hit")).toBeDefined();
    expect(screen.getByRole("link", { name: "Open local photo" })).toHaveAttribute(
      "href",
      "/api/v1/aircraft/VN1234/photo/local",
    );
    expect(screen.getByRole("link", { name: "Open source image" })).toHaveAttribute(
      "href",
      "https://cdn.planespotters.net/photo/test.jpg",
    );
  });

  test("renders warming badge when metadata is a cache miss", () => {
    const aircraft = makeAircraft();
    mockUseAircraftPhotoMetadata.mockReturnValue({
      metadata: {
        icao: "VN1234",
        cacheHit: false,
        sourceUrl: null,
        cachedAt: null,
        contentType: null,
        localPhotoUrl: null,
      },
      isLoading: false,
    });
    useAircraftStore.setState({
      aircraft: { VN1234: aircraft },
      selectedIcao: "VN1234",
      detailIcao: "VN1234",
    });

    render(<AircraftDetailPanel />);

    expect(screen.getByText("Cache warming")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Open local photo" })).toBeNull();
  });

  test("renders the full country name instead of ISO code", () => {
    const aircraft = makeAircraft({ countryCode: "CN" });
    useAircraftStore.setState({
      aircraft: { VN1234: aircraft },
      selectedIcao: "VN1234",
      detailIcao: "VN1234",
    });

    render(<AircraftDetailPanel />);

    expect(screen.getByText("China")).toBeDefined();
    expect(screen.queryByText("CN")).toBeNull();
  });

  test("renders military badge and class field for military aircraft", () => {
    const aircraft = makeAircraft({ isMilitary: true });
    useAircraftStore.setState({
      aircraft: { VN1234: aircraft },
      selectedIcao: "VN1234",
      detailIcao: "VN1234",
    });

    render(<AircraftDetailPanel />);

    expect(screen.getAllByText("Military").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Class")).toBeDefined();
  });
});
