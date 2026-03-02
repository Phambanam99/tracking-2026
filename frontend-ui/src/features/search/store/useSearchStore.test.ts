import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useSearchStore } from "./useSearchStore";
import { filterAircraftInViewport } from "../hooks/useSearchAircraft";
import type { Aircraft } from "../../aircraft/types/aircraftTypes";

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao: "ABC123",
    lat: 21.0,
    lon: 105.0,
    altitude: 35000,
    speed: 480,
    heading: 125,
    eventTime: 1708941600000,
    sourceId: "s1",
    callsign: "VNA321",
    registration: "VN-A321",
    aircraftType: "A321",
    operator: "Vietnam Airlines",
    lastSeen: Date.now(),
    ...overrides,
  };
}

describe("useSearchStore", () => {
  beforeEach(() => {
    useSearchStore.setState({
      filters: { query: "", mode: "viewport" },
      results: [],
      isSearching: false,
      error: null,
      selectedIcao: null,
    });
  });

  afterEach(() => {
    useSearchStore.setState({
      filters: { query: "", mode: "viewport" },
      results: [],
      isSearching: false,
      error: null,
      selectedIcao: null,
    });
  });

  // -------------------------------------------------------------------------
  // setQuery
  // -------------------------------------------------------------------------

  test("setQuery updates query in filters", () => {
    useSearchStore.getState().setQuery("ABC");

    expect(useSearchStore.getState().filters.query).toBe("ABC");
    expect(useSearchStore.getState().filters.mode).toBe("viewport"); // unchanged
  });

  // -------------------------------------------------------------------------
  // setMode
  // -------------------------------------------------------------------------

  test("setMode changes mode and clears results and error", () => {
    useSearchStore.setState({
      results: [
        {
          icao: "ABC123",
          lat: 21.0,
          lon: 105.0,
          eventTime: 0,
        },
      ],
      error: "previous error",
    });

    useSearchStore.getState().setMode("global");

    const state = useSearchStore.getState();
    expect(state.filters.mode).toBe("global");
    expect(state.results).toHaveLength(0);
    expect(state.error).toBeNull();
  });

  test("setMode preserves current query", () => {
    useSearchStore.setState({ filters: { query: "abc", mode: "viewport" } });

    useSearchStore.getState().setMode("history");

    expect(useSearchStore.getState().filters.query).toBe("abc");
    expect(useSearchStore.getState().filters.mode).toBe("history");
  });

  // -------------------------------------------------------------------------
  // clearSearch
  // -------------------------------------------------------------------------

  test("clearSearch resets all state to initial values", () => {
    useSearchStore.setState({
      filters: { query: "test", mode: "global" },
      results: [{ icao: "ABC123", lat: 21.0, lon: 105.0, eventTime: 0 }],
      isSearching: true,
      error: "error msg",
      selectedIcao: "ABC123",
    });

    useSearchStore.getState().clearSearch();

    const state = useSearchStore.getState();
    expect(state.filters.query).toBe("");
    expect(state.filters.mode).toBe("viewport");
    expect(state.results).toHaveLength(0);
    expect(state.isSearching).toBe(false);
    expect(state.error).toBeNull();
    expect(state.selectedIcao).toBeNull();
  });

  // -------------------------------------------------------------------------
  // selectResult
  // -------------------------------------------------------------------------

  test("selectResult saves the selected ICAO", () => {
    useSearchStore.getState().selectResult("DEF456");

    expect(useSearchStore.getState().selectedIcao).toBe("DEF456");
  });

  test("selectResult can be cleared with null", () => {
    useSearchStore.setState({ selectedIcao: "ABC123" });

    useSearchStore.getState().selectResult(null);

    expect(useSearchStore.getState().selectedIcao).toBeNull();
  });
});

// -------------------------------------------------------------------------
// filterAircraftInViewport
// -------------------------------------------------------------------------

describe("filterAircraftInViewport", () => {
  const aircraft: Record<string, Aircraft> = {
    ABC123: makeAircraft({ icao: "ABC123", callsign: "VNA321", registration: "VN-A321", aircraftType: "A321", operator: "Vietnam Airlines" }),
    DEF456: makeAircraft({ icao: "DEF456", callsign: "BAV456", registration: "VN-B737", aircraftType: "B737", operator: "Bamboo" }),
    GHI789: makeAircraft({ icao: "GHI789", callsign: undefined, registration: undefined, aircraftType: undefined, operator: undefined }),
  };

  test("returns empty list for query shorter than 2 chars", () => {
    expect(filterAircraftInViewport(aircraft, "A")).toHaveLength(0);
    expect(filterAircraftInViewport(aircraft, "")).toHaveLength(0);
  });

  test("matches by ICAO prefix", () => {
    const results = filterAircraftInViewport(aircraft, "abc");
    expect(results).toHaveLength(1);
    expect(results[0].icao).toBe("ABC123");
  });

  test("matches by callsign (case-insensitive)", () => {
    const results = filterAircraftInViewport(aircraft, "vna");
    expect(results.map((r) => r.icao)).toContain("ABC123");
  });

  test("matches by registration", () => {
    const results = filterAircraftInViewport(aircraft, "vn-b737");
    expect(results.map((r) => r.icao)).toContain("DEF456");
  });

  test("matches by aircraft type", () => {
    const results = filterAircraftInViewport(aircraft, "a321");
    expect(results.map((r) => r.icao)).toContain("ABC123");
  });

  test("matches by operator", () => {
    const results = filterAircraftInViewport(aircraft, "bamboo");
    expect(results.map((r) => r.icao)).toContain("DEF456");
  });

  test("returns at most 50 results", () => {
    const many: Record<string, Aircraft> = {};
    for (let i = 0; i < 80; i++) {
      const icao = `A${String(i).padStart(5, "0")}`;
      many[icao] = makeAircraft({ icao, callsign: "TEST" });
    }

    const results = filterAircraftInViewport(many, "test");

    expect(results).toHaveLength(50);
  });

  test("returns empty when no aircraft match query", () => {
    const results = filterAircraftInViewport(aircraft, "ZZZZZZ");
    expect(results).toHaveLength(0);
  });
});
