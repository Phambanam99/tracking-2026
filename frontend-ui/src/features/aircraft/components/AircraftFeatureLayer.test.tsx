import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("../../auth/store/useAuthStore", () => ({
  useAuthStore: (selector: (state: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: "token" }),
}));

vi.mock("../../map/store/useLayerStore", () => ({
  useLayerStore: (selector: (state: {
    visible: { live: boolean; watchlist: boolean; trail: boolean; military: boolean };
    aircraftFilter: "all" | "watchlist";
  }) => unknown) =>
    selector({
      visible: { live: true, watchlist: true, trail: true, military: false },
      aircraftFilter: "all",
    }),
}));

vi.mock("../../map/hooks/useMapViewport", () => ({
  useMapViewport: () => ({
    north: 20,
    south: 10,
    east: 110,
    west: 100,
  }),
}));

vi.mock("../../watchlist/store/useWatchlistStore", () => ({
  useWatchlistStore: (selector: (state: { groups: never[] }) => unknown) => selector({ groups: [] }),
}));

vi.mock("../../playback/store/usePlaybackStore", () => ({
  usePlaybackStore: (selector: (state: { isBarVisible: boolean; status: string }) => unknown) =>
    selector({ isBarVisible: true, status: "ready" }),
}));

vi.mock("../store/useAircraftStore", () => ({
  useAircraftStore: (selector: (state: {
    retainOnly: (icaos: Set<string>) => void;
  }) => unknown) =>
    selector({
      retainOnly: vi.fn(),
    }),
}));

vi.mock("../hooks/useAircraftSocket", () => ({
  useAircraftSocket: vi.fn(),
}));

vi.mock("../hooks/useViewportSnapshot", () => ({
  useViewportSnapshot: vi.fn(),
}));

vi.mock("./AircraftMapLayer", () => ({
  AircraftMapLayer: ({ visible, variant }: { visible: boolean; variant?: string }) => (
    <div data-testid={`map-layer-${variant ?? "live"}`}>{String(visible)}</div>
  ),
}));

vi.mock("./HistoryTrailLayer", () => ({
  HistoryTrailLayer: ({ visible }: { visible: boolean }) => <div data-testid="history-trail">{String(visible)}</div>,
}));

vi.mock("../../playback/components/PlaybackMapLayer", () => ({
  PlaybackMapLayer: () => <div data-testid="playback-layer" />,
}));

vi.mock("./AircraftPopup", () => ({
  AircraftPopup: () => <div data-testid="aircraft-popup-stub" />,
}));

vi.mock("./AircraftDetailPanel", () => ({
  AircraftDetailPanel: () => <div data-testid="aircraft-detail-stub" />,
}));

import { AircraftFeatureLayer } from "./AircraftFeatureLayer";

describe("AircraftFeatureLayer", () => {
  test("renders without throwing when playback bar state is enabled", () => {
    render(<AircraftFeatureLayer />);

    expect(screen.getByTestId("playback-layer")).toBeDefined();
    expect(screen.getByTestId("aircraft-popup-stub")).toBeDefined();
  });
});
