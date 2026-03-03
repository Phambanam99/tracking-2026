import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_SHIP_TRAIL_WINDOW_MS, useShipStore } from "./useShipStore";

describe("useShipStore", () => {
  beforeEach(() => {
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T12:00:00Z"));
  });

  afterEach(() => {
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
    vi.useRealTimers();
  });

  test("keeps the newest ship position by event time", () => {
    useShipStore.getState().upsertShip({
      mmsi: "574001230",
      lat: 10,
      lon: 106,
      speed: 12,
      course: 180,
      heading: 180,
      navStatus: null,
      vesselName: "PACIFIC",
      vesselType: "cargo",
      imo: null,
      callSign: null,
      destination: null,
      eta: null,
      eventTime: 200,
      sourceId: "AIS",
      isHistorical: false,
      metadata: null,
      lastSeen: Date.now(),
    });

    useShipStore.getState().upsertShip({
      mmsi: "574001230",
      lat: 11,
      lon: 107,
      speed: 13,
      course: 181,
      heading: 181,
      navStatus: null,
      vesselName: "OLDER",
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
    });

    expect(useShipStore.getState().ships["574001230"]?.lat).toBe(10);
  });

  test("prunes stale ships by lastSeen", () => {
    useShipStore.setState({
      ships: {
        fresh: {
          mmsi: "fresh",
          lat: 10,
          lon: 106,
          speed: null,
          course: null,
          heading: null,
          navStatus: null,
          vesselName: null,
          vesselType: null,
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
        stale: {
          mmsi: "stale",
          lat: 10,
          lon: 106,
          speed: null,
          course: null,
          heading: null,
          navStatus: null,
          vesselName: null,
          vesselType: null,
          imo: null,
          callSign: null,
          destination: null,
          eta: null,
          eventTime: 100,
          sourceId: "AIS",
          isHistorical: false,
          metadata: null,
          lastSeen: Date.now() - 301_000,
        },
      },
      selectedMmsi: "stale",
      detailMmsi: "stale",
      selectedMode: "history",
      detailMode: "history",
      trailMmsi: "stale",
      trailAnchorTime: 100,
      trailPoints: [{ lat: 10, lon: 106, eventTime: 100, speed: null, course: null, heading: null, sourceId: "AIS" }],
      trailRangeFrom: 1,
      trailRangeTo: 2,
      trailStatus: "ready",
      trailError: null,
      trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
    });

    useShipStore.getState().pruneStale(300_000);

    expect(Object.keys(useShipStore.getState().ships)).toEqual(["fresh"]);
    expect(useShipStore.getState().selectedMmsi).toBeNull();
    expect(useShipStore.getState().detailMmsi).toBeNull();
    expect(useShipStore.getState().selectedMode).toBeNull();
    expect(useShipStore.getState().detailMode).toBeNull();
    expect(useShipStore.getState().trailMmsi).toBeNull();
    expect(useShipStore.getState().trailPoints).toEqual([]);
    expect(useShipStore.getState().trailStatus).toBe("idle");
  });

  test("updates selection and detail state with search mode context", () => {
    useShipStore.getState().selectShip("574001230", "history");
    useShipStore.getState().showDetails("574001230", "history");

    expect(useShipStore.getState().selectedMmsi).toBe("574001230");
    expect(useShipStore.getState().detailMmsi).toBe("574001230");
    expect(useShipStore.getState().selectedMode).toBe("history");
    expect(useShipStore.getState().detailMode).toBe("history");

    useShipStore.getState().hideDetails();
    useShipStore.getState().selectShip(null);

    expect(useShipStore.getState().selectedMmsi).toBeNull();
    expect(useShipStore.getState().detailMmsi).toBeNull();
    expect(useShipStore.getState().selectedMode).toBeNull();
    expect(useShipStore.getState().detailMode).toBeNull();
  });

  test("stores and clears history trail preview state", () => {
    useShipStore.getState().setTrailLoading("574001230", 500, 100, 600);
    expect(useShipStore.getState().trailStatus).toBe("loading");

    useShipStore.getState().setTrailReady(
      "574001230",
      500,
      [
        { lat: 10, lon: 106, eventTime: 100, speed: 10, course: 90, heading: 91, sourceId: "AIS" },
        { lat: 10.5, lon: 106.5, eventTime: 500, speed: 11, course: 92, heading: 93, sourceId: "AIS" },
      ],
      100,
      600,
    );

    expect(useShipStore.getState().trailMmsi).toBe("574001230");
    expect(useShipStore.getState().trailPoints).toHaveLength(2);
    expect(useShipStore.getState().trailStatus).toBe("ready");

    useShipStore.getState().clearTrail();

    expect(useShipStore.getState().trailMmsi).toBeNull();
    expect(useShipStore.getState().trailPoints).toEqual([]);
    expect(useShipStore.getState().trailStatus).toBe("idle");
  });

  test("updates trail window preset", () => {
    useShipStore.getState().setTrailWindow(1_800_000);
    expect(useShipStore.getState().trailWindowMs).toBe(1_800_000);

    useShipStore.getState().setTrailWindow(7_200_000);
    expect(useShipStore.getState().trailWindowMs).toBe(7_200_000);
  });
});
