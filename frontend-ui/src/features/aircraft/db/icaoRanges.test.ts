import { describe, expect, test } from "vitest";
import { buildCountryFlagUrl, findIcaoCountry, normalizeIcaoHex } from "./icaoRanges";

describe("icaoRanges", () => {
  test("normalizes valid ICAO hex strings", () => {
    expect(normalizeIcaoHex(" a00001 ")).toBe("A00001");
  });

  test("rejects invalid ICAO hex strings", () => {
    expect(normalizeIcaoHex("XYZ")).toBeNull();
    expect(normalizeIcaoHex("GGGGGG")).toBeNull();
  });

  test("resolves country ranges including specific sub-ranges before catch-all ranges", () => {
    expect(findIcaoCountry("888123")).toEqual({
      countryCode: "VN",
      countryName: "Vietnam",
      countryFlagUrl: "https://flagcdn.com/h80/vn.png",
    });

    expect(findIcaoCountry("424B10")).toEqual({
      countryCode: "IM",
      countryName: "Isle of Man",
      countryFlagUrl: "https://flagcdn.com/h80/im.png",
    });
  });

  test("returns null when ICAO does not match a known range", () => {
    expect(findIcaoCountry("FFFFFF")).toBeNull();
  });

  test("builds flag URLs from country codes", () => {
    expect(buildCountryFlagUrl("US")).toBe("https://flagcdn.com/h80/us.png");
  });
});
