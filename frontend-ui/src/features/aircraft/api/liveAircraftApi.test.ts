import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchLiveAircraftInViewport } from "./liveAircraftApi";

const originalFetch = global.fetch;

describe("fetchLiveAircraftInViewport", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/api/v1/aircraft/live?");
      expect(url).toContain("north=21.1");
      expect(url).toContain("south=21");
      expect(url).toContain("east=105.9");
      expect(url).toContain("west=105.7");
      return new Response(
        JSON.stringify([
          {
            icao: "ABC123",
            lat: 21.02,
            lon: 105.81,
            altitude: 35000,
            speed: 480,
            heading: 125,
            eventTime: 1708941600000,
            sourceId: "RADARBOX",
            registration: "VN-A321",
            aircraftType: "A321",
            operator: "Vietnam Airlines",
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("maps live viewport results into aircraft store entries", async () => {
    const aircraft = await fetchLiveAircraftInViewport({
      north: 21.1,
      south: 21.0,
      east: 105.9,
      west: 105.7,
    });

    expect(aircraft).toEqual([
      {
        icao: "ABC123",
        lat: 21.02,
        lon: 105.81,
        altitude: 35000,
        speed: 480,
        heading: 125,
        eventTime: 1708941600000,
        sourceId: "RADARBOX",
        registration: "VN-A321",
        aircraftType: "A321",
        operator: "Vietnam Airlines",
        countryCode: null,
        countryFlagUrl: null,
        lastSeen: expect.any(Number),
      },
    ]);
  });
});
