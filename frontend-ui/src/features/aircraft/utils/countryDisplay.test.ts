import { describe, expect, test } from "vitest";
import { getCountryName } from "./countryDisplay";

describe("getCountryName", () => {
  test("returns the full country name for a valid ISO code", () => {
    expect(getCountryName("CN")).toBe("China");
  });

  test("normalizes lowercase codes", () => {
    expect(getCountryName("vn")).toBe("Vietnam");
  });

  test("returns null when the code is missing", () => {
    expect(getCountryName(null)).toBeNull();
    expect(getCountryName("")).toBeNull();
  });
});
