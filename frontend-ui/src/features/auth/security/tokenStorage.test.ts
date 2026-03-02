import { afterEach, describe, expect, test } from "vitest";
import { clearTokens, loadTokens, saveTokens } from "./tokenStorage";

describe("tokenStorage", () => {
  afterEach(() => {
    clearTokens();
  });

  test("should persist access and refresh tokens in sessionStorage", () => {
    clearTokens();
    saveTokens("access", "refresh");

    const tokens = loadTokens();

    expect(tokens.accessToken).toBe("access");
    expect(tokens.refreshToken).toBe("refresh");
    expect(sessionStorage.getItem("tracking_auth_tokens")).toContain("\"accessToken\":\"access\"");
  });

  test("should clear both tokens", () => {
    saveTokens("access", "refresh");
    clearTokens();

    const tokens = loadTokens();

    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
    expect(sessionStorage.getItem("tracking_auth_tokens")).toBeNull();
  });

  test("should recover gracefully from malformed sessionStorage data", () => {
    sessionStorage.setItem("tracking_auth_tokens", "{not-json");

    const tokens = loadTokens();

    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
  });
});
