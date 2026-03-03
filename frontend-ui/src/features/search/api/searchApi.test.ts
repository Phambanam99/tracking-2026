import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configureHttpClient } from "../../../shared/api/httpClient";
import { searchHistory } from "./searchApi";

describe("searchApi", () => {
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

  test("maps history search datetime-local filters to backend epoch millis payload", async () => {
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
      expect(body.registration).toBeUndefined();

      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await searchHistory({
      query: "",
      icao: "ABC123",
      registration: "VN-A321",
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
    expect(url).toBe("/api/v1/aircraft/search/history");
    expect(requestInit.method).toBe("POST");
  });
});
