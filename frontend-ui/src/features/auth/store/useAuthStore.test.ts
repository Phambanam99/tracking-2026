import { afterEach, describe, expect, test, vi } from "vitest";
import { getAuthState, refreshSession, resetAuthStoreForTest, setAuthTokens } from "./useAuthStore";

vi.mock("../api/authApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/authApi")>();
  return { ...original, refreshToken: vi.fn() };
});

function makeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${header}.${body}.sig`;
}

describe("useAuthStore state", () => {
  afterEach(() => {
    resetAuthStoreForTest();
    vi.restoreAllMocks();
  });

  test("should derive username and roles from access token claims", () => {
    resetAuthStoreForTest();
    const token = makeUnsignedJwt({
      sub: "pilot",
      roles: ["ROLE_USER", "ROLE_ADMIN"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    setAuthTokens(token, "refresh-token");

    const state = getAuthState();

    expect(state.accessToken).toBe(token);
    expect(state.refreshToken).toBe("refresh-token");
    expect(state.username).toBe("pilot");
    expect(state.roles).toEqual(["ROLE_USER", "ROLE_ADMIN"]);
  });
});

describe("refreshSession — concurrent deduplication", () => {
  afterEach(() => {
    resetAuthStoreForTest();
    vi.restoreAllMocks();
  });

  test("should only call the refresh API once when invoked concurrently", async () => {
    const { refreshToken: refreshTokenApi } = await import("../api/authApi");

    const existingAccess = makeUnsignedJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
    const existingRefresh = makeUnsignedJwt({ sub: "user", type: "refresh", exp: Math.floor(Date.now() / 1000) + 86400 });
    setAuthTokens(existingAccess, existingRefresh);

    const newAccess = makeUnsignedJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 7200 });
    const newRefresh = makeUnsignedJwt({ sub: "user", type: "refresh", exp: Math.floor(Date.now() / 1000) + 172800 });
    vi.mocked(refreshTokenApi).mockResolvedValue({ accessToken: newAccess, refreshToken: newRefresh });

    // Both calls happen synchronously before any await — the second should reuse the in-flight promise
    const p1 = refreshSession();
    const p2 = refreshSession();

    const [result1, result2] = await Promise.all([p1, p2]);

    expect(vi.mocked(refreshTokenApi)).toHaveBeenCalledTimes(1);
    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });
});
