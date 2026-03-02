import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearAuthSession, setAuthTokens } from "../../auth/store/useAuthStore";
import { useAircraftPhotoMetadata } from "./useAircraftPhotoMetadata";

describe("useAircraftPhotoMetadata", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAuthTokens("test-token", "refresh-token");
  });

  afterEach(() => {
    clearAuthSession();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("returns metadata when local cache exists", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          icao: "ABC123",
          cacheHit: true,
          sourceUrl: "https://cdn.planespotters.net/photo/test.jpg",
          cachedAt: "2026-03-02T07:00:00Z",
          contentType: "image/jpeg",
          localPhotoUrl: "/api/v1/aircraft/ABC123/photo/local",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    const { result } = renderHook(() => useAircraftPhotoMetadata("ABC123"));

    await waitFor(() => {
      expect(result.current.metadata?.cacheHit).toBe(true);
    });
    expect(result.current.metadata?.localPhotoUrl).toBe("/api/v1/aircraft/ABC123/photo/local");
  });

  test("returns null metadata on fetch failure", async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;

    const { result } = renderHook(() => useAircraftPhotoMetadata("ABC123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.metadata).toBeNull();
  });
});
