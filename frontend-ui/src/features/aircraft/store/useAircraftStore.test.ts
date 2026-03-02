import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAircraftStore } from "./useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";
import type { TrailPosition } from "../types/trailTypes";

function makeAircraft(icao: string, overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao,
    lat: 10.0,
    lon: 106.0,
    lastSeen: Date.now(),
    ...overrides,
  };
}

describe("useAircraftStore", () => {
  beforeEach(() => {
    // Reset to clean state before each test
    useAircraftStore.setState({
      aircraft: {},
      selectedIcao: null,
      detailIcao: null,
      trailIcao: null,
      trailPositions: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("upsertAircraft", () => {
    test("should add a new aircraft", () => {
      const ac = makeAircraft("ABC123");
      useAircraftStore.getState().upsertAircraft(ac);
      expect(useAircraftStore.getState().aircraft["ABC123"]).toEqual(ac);
    });

    test("should update an existing aircraft, merging fields", () => {
      const initial = makeAircraft("ABC123", { altitude: 5000 });
      useAircraftStore.getState().upsertAircraft(initial);

      const updated = makeAircraft("ABC123", { altitude: 10000, callsign: "VN123" });
      useAircraftStore.getState().upsertAircraft(updated);

      const ac = useAircraftStore.getState().aircraft["ABC123"];
      expect(ac.altitude).toBe(10000);
      expect(ac.callsign).toBe("VN123");
    });

    test("should keep other aircraft when upserting a different one", () => {
      useAircraftStore.getState().upsertAircraft(makeAircraft("AAA001"));
      useAircraftStore.getState().upsertAircraft(makeAircraft("BBB002"));

      const aircraft = useAircraftStore.getState().aircraft;
      expect(Object.keys(aircraft)).toHaveLength(2);
      expect(aircraft["AAA001"]).toBeDefined();
      expect(aircraft["BBB002"]).toBeDefined();
    });

    test("should append a live trail point when the active trail aircraft updates", () => {
      const now = Date.now();
      const historical: TrailPosition[] = [
        { lat: 10.0, lon: 106.0, altitude: 10000, heading: 90, eventTime: now - 60_000 },
      ];
      useAircraftStore.getState().setTrail("ABC123", historical);

      useAircraftStore.getState().upsertAircraft(
        makeAircraft("ABC123", {
          lat: 10.5,
          lon: 106.5,
          altitude: 11000,
          heading: 100,
          lastSeen: now,
        }),
      );

      expect(useAircraftStore.getState().trailPositions).toEqual([
        historical[0],
        {
          lat: 10.5,
          lon: 106.5,
          altitude: 11000,
          heading: 100,
          eventTime: now,
        },
      ]);
    });

    test("should not append trail positions for non-active aircraft", () => {
      useAircraftStore.getState().setTrail("ABC123", []);

      useAircraftStore.getState().upsertAircraft(makeAircraft("OTHER1"));

      expect(useAircraftStore.getState().trailPositions).toEqual([]);
    });
  });

  describe("selectAircraft", () => {
    test("should set selectedIcao", () => {
      useAircraftStore.getState().selectAircraft("ABC123");
      expect(useAircraftStore.getState().selectedIcao).toBe("ABC123");
    });

    test("should set selectedIcao to null to deselect", () => {
      useAircraftStore.getState().selectAircraft("ABC123");
      useAircraftStore.getState().selectAircraft(null);
      expect(useAircraftStore.getState().selectedIcao).toBeNull();
    });

    test("should clear the trail when aircraft is deselected", () => {
      useAircraftStore.getState().setTrail("ABC123", [
        { lat: 1, lon: 2, altitude: null, heading: null, eventTime: 123 },
      ]);

      useAircraftStore.getState().selectAircraft(null);

      expect(useAircraftStore.getState().trailIcao).toBeNull();
      expect(useAircraftStore.getState().trailPositions).toEqual([]);
    });

    test("should clear the previous trail when selecting another aircraft", () => {
      useAircraftStore.getState().setTrail("ABC123", [
        { lat: 1, lon: 2, altitude: null, heading: null, eventTime: 123 },
      ]);

      useAircraftStore.getState().selectAircraft("DIFF99");

      expect(useAircraftStore.getState().trailIcao).toBeNull();
      expect(useAircraftStore.getState().trailPositions).toEqual([]);
    });
  });

  describe("trail actions", () => {
    test("should replace the active trail when setTrail is called again", () => {
      useAircraftStore.getState().setTrail("ABC123", [
        { lat: 1, lon: 2, altitude: null, heading: null, eventTime: 123 },
      ]);

      const replacement: TrailPosition[] = [
        { lat: 3, lon: 4, altitude: 5000, heading: 180, eventTime: 456 },
        { lat: 5, lon: 6, altitude: 6000, heading: 200, eventTime: 789 },
      ];
      useAircraftStore.getState().setTrail("XYZ999", replacement);

      expect(useAircraftStore.getState().trailIcao).toBe("XYZ999");
      expect(useAircraftStore.getState().trailPositions).toEqual(replacement);
    });

    test("should clear trail state", () => {
      useAircraftStore.getState().setTrail("ABC123", [
        { lat: 1, lon: 2, altitude: null, heading: null, eventTime: 123 },
      ]);

      useAircraftStore.getState().clearTrail();

      expect(useAircraftStore.getState().trailIcao).toBeNull();
      expect(useAircraftStore.getState().trailPositions).toEqual([]);
    });
  });

  describe("pruneStale", () => {
    test("should remove aircraft older than maxAgeMs", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const stale = makeAircraft("STALE1", { lastSeen: now - 5000 });
      const fresh = makeAircraft("FRESH1", { lastSeen: now - 1000 });

      useAircraftStore.getState().upsertAircraft(stale);
      useAircraftStore.getState().upsertAircraft(fresh);

      useAircraftStore.getState().pruneStale(3000);

      const aircraft = useAircraftStore.getState().aircraft;
      expect("STALE1" in aircraft).toBe(false);
      expect("FRESH1" in aircraft).toBe(true);
    });

    test("should not affect aircraft within maxAgeMs", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const ac = makeAircraft("VN001", { lastSeen: now - 100 });
      useAircraftStore.getState().upsertAircraft(ac);

      useAircraftStore.getState().pruneStale(120_000);

      expect(useAircraftStore.getState().aircraft["VN001"]).toBeDefined();
    });

    test("should deselect selected aircraft if it is pruned", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const staleSelected = makeAircraft("SELECTED", { lastSeen: now - 9999 });
      useAircraftStore.getState().upsertAircraft(staleSelected);
      useAircraftStore.getState().selectAircraft("SELECTED");

      expect(useAircraftStore.getState().selectedIcao).toBe("SELECTED");

      useAircraftStore.getState().pruneStale(5000);

      expect(useAircraftStore.getState().selectedIcao).toBeNull();
    });

    test("should clear the trail if the trailed aircraft is pruned", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      useAircraftStore.getState().upsertAircraft(
        makeAircraft("TRAIL1", { lastSeen: now - 9999 }),
      );
      useAircraftStore.getState().setTrail("TRAIL1", [
        { lat: 1, lon: 2, altitude: null, heading: null, eventTime: now - 9999 },
      ]);

      useAircraftStore.getState().pruneStale(5000);

      expect(useAircraftStore.getState().trailIcao).toBeNull();
      expect(useAircraftStore.getState().trailPositions).toEqual([]);
    });

    test("should keep selectedIcao if the selected aircraft is still fresh", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const fresh = makeAircraft("VNG001", { lastSeen: now - 100 });
      useAircraftStore.getState().upsertAircraft(fresh);
      useAircraftStore.getState().selectAircraft("VNG001");

      useAircraftStore.getState().pruneStale(30_000);

      expect(useAircraftStore.getState().selectedIcao).toBe("VNG001");
    });
  });
});
