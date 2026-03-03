import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configureHttpClient } from "../../../shared/api/httpClient";
import { getShipHistory, searchShipHistory } from "./shipSearchApi";

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
});
