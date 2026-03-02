import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configureHttpClient } from "../../../shared/api/httpClient";
import { disableUser, enableUser, listUsers } from "./userAdminApi";

describe("userAdminApi", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    configureHttpClient({
      baseUrl: "",
      getAccessToken: () => "access-token",
      refreshSession: async () => false,
      onUnauthorized: () => undefined,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("should call list users endpoint with pagination params", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        content: [],
        page: 1,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    globalThis.fetch = fetchMock as typeof fetch;

    await listUsers(1, 10);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/users?page=1&size=10");
    expect(requestInit.method).toBe("GET");
    expect((requestInit.headers as Record<string, string>).Authorization).toBe("Bearer access-token");
  });

  test("should call disable and enable endpoints with put method", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await disableUser(22);
    await enableUser(22);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/auth/users/22/disable",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/users/22/enable",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
