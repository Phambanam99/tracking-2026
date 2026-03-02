import { describe, expect, test } from "vitest";
import type { Aircraft } from "../types/aircraftTypes";
import { shouldRenderAircraft } from "./AircraftMapLayer";

function buildAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao: "ABC123",
    lat: 10,
    lon: 106,
    lastSeen: 1700000000000,
    isMilitary: false,
    ...overrides,
  };
}

describe("shouldRenderAircraft", () => {
  test("returns true for all filter", () => {
    expect(shouldRenderAircraft(buildAircraft(), "all", new Set())).toBe(true);
  });

  test("returns true for watchlist filter when aircraft is in visible groups", () => {
    expect(shouldRenderAircraft(buildAircraft(), "watchlist", new Set(["abc123"]))).toBe(true);
  });

  test("returns false for watchlist filter when aircraft is not in visible groups", () => {
    expect(shouldRenderAircraft(buildAircraft(), "watchlist", new Set(["def456"]))).toBe(false);
  });

  test("returns true for military filter only when backend marks aircraft as military", () => {
    expect(shouldRenderAircraft(buildAircraft({ isMilitary: true }), "military", new Set())).toBe(true);
    expect(shouldRenderAircraft(buildAircraft(), "military", new Set())).toBe(false);
  });
});
