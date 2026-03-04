import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useShipStore } from "../store/useShipStore";
import { useShipViewportSnapshot } from "./useShipViewportSnapshot";

const fetchLiveShipsInViewport = vi.fn();

vi.mock("../api/shipSearchApi", () => ({
  fetchLiveShipsInViewport: (...args: unknown[]) => fetchLiveShipsInViewport(...args),
}));

function HookHarness(props: {
  token: string | null;
  viewport: { north: number; south: number; east: number; west: number };
}): JSX.Element | null {
  useShipViewportSnapshot(props.token, props.viewport);
  return null;
}

describe("useShipViewportSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchLiveShipsInViewport.mockReset();
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
      trailWindowMs: 21_600_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("hydrates viewport ships immediately on first load", async () => {
    fetchLiveShipsInViewport.mockResolvedValue([
      {
        mmsi: "413387870",
        lat: 19,
        lon: 108.6,
        speed: 9,
        course: 120,
        heading: 122,
        navStatus: null,
        vesselName: "FU TENG",
        vesselType: "cargo",
        imo: null,
        callSign: null,
        destination: null,
        eta: null,
        eventTime: 300,
        sourceId: "CHINAPORT-AIS",
        isHistorical: false,
        metadata: null,
        lastSeen: Date.now(),
      },
    ]);

    render(
      <HookHarness
        token="jwt"
        viewport={{ north: 30, south: 0, east: 125, west: 90 }}
      />,
    );

    await vi.runAllTimersAsync();

    expect(fetchLiveShipsInViewport).toHaveBeenCalledTimes(1);
    expect(useShipStore.getState().ships["413387870"]?.vesselName).toBe("FU TENG");
  });
});
