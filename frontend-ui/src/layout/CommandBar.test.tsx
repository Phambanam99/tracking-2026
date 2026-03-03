import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useAircraftStore } from "../features/aircraft/store/useAircraftStore";

const mockAnimate = vi.fn();
const mockGetZoom = vi.fn().mockReturnValue(6);

vi.mock("../features/map/context/MapContext", () => ({
  useMapContext: () => ({
    map: {
      getView: () => ({
        animate: mockAnimate,
        getZoom: mockGetZoom,
      }),
    },
  }),
}));

import { CommandBar } from "./CommandBar";

describe("CommandBar", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("767px") ? false : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    window.localStorage.clear();
    mockAnimate.mockClear();
    useAircraftStore.setState({
      aircraft: {
        AAA111: {
          icao: "AAA111",
          callsign: "AAA001",
          lat: 10,
          lon: 106,
          altitude: 32000,
          speed: 430,
          heading: 90,
          eventTime: 1700000000000,
          lastSeen: 1700000000000,
          registration: "VN-A321",
          aircraftType: "A321",
          operator: "Vietnam Airlines",
          countryCode: "VN",
          countryFlagUrl: null,
          sourceId: "RADARBOX",
          isMilitary: false,
        },
      },
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
  });

  test("selects a live aircraft result and opens its detail context", () => {
    render(
      <CommandBar
        isAdmin={false}
        isAuthenticated={true}
        isOpen={true}
        onClose={vi.fn()}
        onOpen={vi.fn()}
        onOpenAdminApiKeys={vi.fn()}
        onOpenAdminUsers={vi.fn()}
        onOpenLogin={vi.fn()}
        onOpenRegister={vi.fn()}
        onOpenSearchPanel={vi.fn()}
        onOpenWatchlistPanel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Command bar input"), {
      target: { value: "aa" },
    });

    fireEvent.click(screen.getByRole("button", { name: /AAA001/i }));

    expect(useAircraftStore.getState().selectedIcao).toBe("AAA111");
    expect(useAircraftStore.getState().detailIcao).toBe("AAA111");
    expect(mockAnimate).toHaveBeenCalledTimes(1);
  });

  test("runs panel command actions", () => {
    const onOpenSearchPanel = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandBar
        isAdmin={false}
        isAuthenticated={true}
        isOpen={true}
        onClose={onClose}
        onOpen={vi.fn()}
        onOpenAdminApiKeys={vi.fn()}
        onOpenAdminUsers={vi.fn()}
        onOpenLogin={vi.fn()}
        onOpenRegister={vi.fn()}
        onOpenSearchPanel={onOpenSearchPanel}
        onOpenWatchlistPanel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open search panel/i }));

    expect(onOpenSearchPanel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("uses full-width mobile sheet styling when viewport is mobile", () => {
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

    const { container } = render(
      <CommandBar
        isAdmin={false}
        isAuthenticated={true}
        isOpen={true}
        onClose={vi.fn()}
        onOpen={vi.fn()}
        onOpenAdminApiKeys={vi.fn()}
        onOpenAdminUsers={vi.fn()}
        onOpenLogin={vi.fn()}
        onOpenRegister={vi.fn()}
        onOpenSearchPanel={vi.fn()}
        onOpenWatchlistPanel={vi.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass("right-16");
    expect(screen.getByLabelText("Command bar input").closest("section")).toHaveClass("w-[calc(100vw-1.5rem)]");
  });
});
