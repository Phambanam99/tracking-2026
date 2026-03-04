import { describe, expect, test } from "vitest";
import { resolveShipVisualStyle } from "./shipVisuals";

describe("resolveShipVisualStyle", () => {
  test("prioritizes tracked ships over vessel type", () => {
    expect(
      resolveShipVisualStyle(
        {
          vesselType: "cargo",
          metadata: { isMilitary: false },
        },
        true,
      ).color,
    ).toBe("#facc15");
  });

  test("maps tanker vessel type to tanker palette", () => {
    const style = resolveShipVisualStyle(
      {
        vesselType: "oil tanker",
        metadata: { isMilitary: false },
      },
      false,
    );

    expect(style.category).toBe("tanker");
    expect(style.color).toBe("#0ea5e9");
  });

  test("keeps military style distinct", () => {
    const style = resolveShipVisualStyle(
      {
        vesselType: "patrol",
        metadata: { isMilitary: true },
      },
      false,
    );

    expect(style.category).toBe("military");
    expect(style.selectedColor).toBe("#fb923c");
  });
});
