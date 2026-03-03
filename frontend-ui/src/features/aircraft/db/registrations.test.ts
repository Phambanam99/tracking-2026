import { describe, expect, test } from "vitest";
import { resolveRegistrationFromHex } from "./registrations";

describe("resolveRegistrationFromHex", () => {
  test("resolves US N-numbers", () => {
    expect(resolveRegistrationFromHex("A00001")).toBe("N1");
  });

  test("handles US N-number range boundaries without leaking invalid suffixes", () => {
    expect(resolveRegistrationFromHex("ADF7C7")).toMatch(/^N[0-9A-Z]+$/);
    expect(resolveRegistrationFromHex("ADF7C7")).not.toContain("-");
    expect(resolveRegistrationFromHex("ADF7C8")).toBeNull();
  });

  test("resolves South Korea HL registrations", () => {
    expect(resolveRegistrationFromHex("71BA00")).toBe("HL7200");
  });

  test("resolves numeric registrations", () => {
    expect(resolveRegistrationFromHex("140000")).toBe("RA-00000");
    expect(resolveRegistrationFromHex("0B03E8")).toBe("CU-T1000");
  });

  test("resolves stride registrations", () => {
    expect(resolveRegistrationFromHex("380000")).toBe("F-BAAA");
    expect(resolveRegistrationFromHex("C00001")).toBe("C-FAAA");
  });

  test("returns null for invalid or unsupported ICAO hex strings", () => {
    expect(resolveRegistrationFromHex("XYZ")).toBeNull();
    expect(resolveRegistrationFromHex("888123")).toBeNull();
  });
});
