import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configureHttpClient } from "../../../shared/api/httpClient";
import { fetchLiveShipsInViewport, getAllShipHistory, getShipHistory, searchShipHistory } from "./shipSearchApi";

describe("shipSearchApi", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    configureHttpClient({
      baseUrl: "",
      getAccessToken: () => null,
      refreshSession: async () => false,
      onUnauthorized: () => undefined,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("maps ship history datetime-local filters to backend epoch millis payload", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;

      expect(body.timeFrom).toBe(new Date(2026, 2, 2, 10, 0, 0, 0).getTime());
      expect(body.timeTo).toBe(new Date(2026, 2, 2, 11, 30, 0, 0).getTime());
      expect(body.boundingBox).toEqual({
        north: 21.1,
        south: 21,
        east: 105.9,
        west: 105.7,
      });

      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await searchShipHistory({
      query: "",
      mmsi: "574001230",
      vesselName: "PACIFIC TRADER",
      timeFrom: "2026-03-02T10:00",
      timeTo: "2026-03-02T11:30",
      boundingBox: {
        north: 21.1,
        south: 21.0,
        east: 105.9,
        west: 105.7,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/ships/search/history");
    expect(requestInit.method).toBe("POST");
  });

  test("requests ship history preview by mmsi with query params", async () => {
    const fetchMock = vi.fn(async () => new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    await getShipHistory("574001230", {
      from: 1_700_000_000_000,
      to: 1_700_000_600_000,
      limit: 120,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/ships/574001230/history?from=1700000000000&to=1700000600000&limit=120");
    expect(requestInit.method).toBe("GET");
  });

  test("uses a 2-hour default live viewport lookback window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T08:00:00Z"));

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.timeTo).toBe(new Date("2026-03-04T08:00:00Z").getTime());
      expect(body.timeFrom).toBe(new Date("2026-03-04T06:00:00Z").getTime());

      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchLiveShipsInViewport({
      north: 21,
      south: 20,
      east: 106,
      west: 105,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("retries viewport history with lower limit on HTTP 400", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T08:00:00Z"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "limit too large" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchLiveShipsInViewport({
      north: 21,
      south: 20,
      east: 106,
      west: 105,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body ?? "{}")) as Record<string, unknown>;
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.body ?? "{}")) as Record<string, unknown>;
    expect(firstBody.limit).toBe(5000);
    expect(secondBody.limit).toBe(2000);
    vi.useRealTimers();
  });

  test("loads full ship history in descending batches and returns ascending points", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("to=4000")) {
        return new Response(JSON.stringify([
          { mmsi: "574001230", lat: 10.4, lon: 106.4, eventTime: 4000, sourceId: "AIS" },
          { mmsi: "574001230", lat: 10.3, lon: 106.3, eventTime: 3000, sourceId: "AIS" },
        ]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("to=2999")) {
        return new Response(JSON.stringify([
          { mmsi: "574001230", lat: 10.2, lon: 106.2, eventTime: 2000, sourceId: "AIS" },
          { mmsi: "574001230", lat: 10.1, lon: 106.1, eventTime: 1000, sourceId: "AIS" },
        ]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const points = await getAllShipHistory("574001230", {
      from: 0,
      to: 4000,
      batchLimit: 2,
      maxBatches: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(points.map((point) => point.eventTime)).toEqual([1000, 2000, 3000, 4000]);
  });
});
