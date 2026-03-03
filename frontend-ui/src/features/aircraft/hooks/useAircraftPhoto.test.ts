import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearAuthSession, setAuthTokens } from "../../auth/store/useAuthStore";
import { useAircraftPhoto } from "./useAircraftPhoto";

describe("useAircraftPhoto", () => {
  const originalFetch = global.fetch;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    act(() => {
      setAuthTokens("test-token", "refresh-token");
    });
    URL.createObjectURL = vi.fn(() => "blob:local-photo");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => {
      clearAuthSession();
    });
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
  });

  test("prefers local cached photo when available", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/photo/local")) {
        return new Response(new Blob(["abc"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() => useAircraftPhoto("ABC123"));

    await waitFor(() => {
      expect(result.current.imageUrl).toBe("blob:local-photo");
    });
    expect(result.current.source).toBe("local");
  });

  test("falls back to Planespotters when local photo is missing", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/photo/local")) {
        return new Response(null, { status: 404 });
      }
      if (url.includes("api.planespotters.net")) {
        return new Response(
          JSON.stringify({
            photos: [{ thumbnail_large: { src: "https://cdn.planespotters.net/photo/test.jpg" } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() => useAircraftPhoto("ABC123"));

    await waitFor(() => {
      expect(result.current.imageUrl).toBe("https://cdn.planespotters.net/photo/test.jpg");
    });
    expect(result.current.source).toBe("planespotters");
  });
});
