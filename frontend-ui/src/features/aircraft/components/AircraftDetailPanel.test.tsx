import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
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
      useAircraftStore.setState({ aircraft: {}, selectedIcao: null, detailIcao: null });
    });
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
    act(() => {
      useAircraftStore.setState({ aircraft: {}, selectedIcao: null, detailIcao: null });
    });
  });

  test("renders cache badge and debug links", () => {
    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        detailIcao: "VN1234",
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <AircraftDetailPanel />
      </I18nProvider>,
    );

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
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        detailIcao: "VN1234",
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <AircraftDetailPanel />
      </I18nProvider>,
    );

    expect(screen.getByText("Cache warming")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Open local photo" })).toBeNull();
  });

  test("renders the full country name instead of ISO code", () => {
    const aircraft = makeAircraft({ countryCode: "CN" });
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        detailIcao: "VN1234",
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <AircraftDetailPanel />
      </I18nProvider>,
    );

    expect(screen.getByText("China")).toBeDefined();
    expect(screen.queryByText("CN")).toBeNull();
  });

  test("renders military badge and class field for military aircraft", () => {
    const aircraft = makeAircraft({ isMilitary: true });
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        detailIcao: "VN1234",
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <AircraftDetailPanel />
      </I18nProvider>,
    );

    expect(screen.getAllByText("Military").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Class")).toBeDefined();
  });

  test("uses bottom-sheet layout on mobile", () => {
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

    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        detailIcao: "VN1234",
      });
    });

    const { container } = render(
      <I18nProvider defaultLanguage="en">
        <AircraftDetailPanel />
      </I18nProvider>,
    );

    expect(container.firstChild).toHaveClass("bottom-20");
    expect(screen.getByText("Aircraft Detail").closest("section")).toHaveClass("animate-slide-in-up");
  });

  test("closes the mobile detail sheet on swipe-down", () => {
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

    const aircraft = makeAircraft();
    act(() => {
      useAircraftStore.setState({
        aircraft: { VN1234: aircraft },
        selectedIcao: "VN1234",
        detailIcao: "VN1234",
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <AircraftDetailPanel />
      </I18nProvider>,
    );

    fireEvent.touchStart(screen.getByText("Aircraft Detail").closest("section")!, {
      touches: [{ clientX: 20, clientY: 40 }],
    });
    fireEvent.touchEnd(screen.getByText("Aircraft Detail").closest("section")!, {
      changedTouches: [{ clientX: 24, clientY: 140 }],
    });

    expect(useAircraftStore.getState().detailIcao).toBeNull();
  });
});
