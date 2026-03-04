import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchFlightHistory } from "./aircraftHistoryApi";

const originalFetch = global.fetch;

describe("fetchFlightHistory", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("sorts positions by event time ascending for trail rendering", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/api/v1/aircraft/a6e88f/history?");
      expect(url).toContain("from=1708941000000");
      expect(url).toContain("to=1708941600000");
      expect(url).toContain("limit=2000");

      return new Response(
        JSON.stringify([
          {
            icao: "A6E88F",
            lat: 21.2,
            lon: 105.7,
            altitude: 32000,
            speed: 430,
            heading: 92,
            eventTime: 1708941500000,
            sourceId: "TEST",
          },
          {
            icao: "A6E88F",
            lat: 21.1,
            lon: 105.6,
            altitude: 30000,
            speed: 420,
            heading: 90,
            eventTime: 1708941200000,
            sourceId: "TEST",
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const history = await fetchFlightHistory("a6e88f", 1708941000000, 1708941600000);

    expect(history.map((point) => point.eventTime)).toEqual([1708941200000, 1708941500000]);
  });
});
