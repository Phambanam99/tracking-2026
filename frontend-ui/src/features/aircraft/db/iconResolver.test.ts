import { describe, expect, test } from "vitest";
import { resolveShape, resolveShapeRef } from "./iconResolver";
import { AircraftShapes } from "./markers";

describe("resolveShapeRef", () => {
  describe("Level 1: type designator lookup", () => {
    test("resolves B738 → airliner", () => {
      expect(resolveShapeRef("B738")).toEqual(["airliner", 1.0]);
    });

    test("resolves A320 → airliner", () => {
      expect(resolveShapeRef("A320")).toEqual(["airliner", 1.0]);
    });

    test("resolves type designator case-insensitively (b738 → airliner)", () => {
      expect(resolveShapeRef("b738")).toEqual(["airliner", 1.0]);
    });

    test("resolves H60 → helicopter", () => {
      expect(resolveShapeRef("H60")).toEqual(["helicopter", 1.0]);
    });

    test("resolves F16 → hi_perf", () => {
      expect(resolveShapeRef("F16")).toEqual(["hi_perf", 1.0]);
    });

    test("resolves C172 → cessna", () => {
      expect(resolveShapeRef("C172")).toEqual(["cessna", 1.0]);
    });
  });

  describe("Level 2: type description + WTC lookup", () => {
    test("resolves L2J + M → jet_swept via L2J-M key", () => {
      expect(resolveShapeRef(null, "L2J", "M")).toEqual(["jet_swept", 1.0]);
    });

    test("resolves L4J + H → heavy_4e via L4J-H key", () => {
      expect(resolveShapeRef(null, "L4J", "H")).toEqual(["heavy_4e", 1.0]);
    });

    test("resolves L2J + H → heavy_2e via L2J-H key", () => {
      expect(resolveShapeRef(null, "L2J", "H")).toEqual(["heavy_2e", 0.9]);
    });
  });

  describe("Level 3: type description (no WTC) lookup", () => {
    test("resolves L2J (no WTC) → jet_swept", () => {
      expect(resolveShapeRef(null, "L2J")).toEqual(["jet_swept", 1.0]);
    });

    test("resolves L1P → cessna", () => {
      expect(resolveShapeRef(null, "L1P")).toEqual(["cessna", 1.0]);
    });

    test("resolves L2T → twin_large with adjusted scale", () => {
      const result = resolveShapeRef(null, "L2T");
      expect(result[0]).toBe("twin_large");
    });
  });

  describe("Level 4: basic type letter fallback", () => {
    test("resolves H2T (no exact match) → helicopter via 'H' prefix", () => {
      // "H2T" is not in TypeDescriptionIcons, but "H" is
      const result = resolveShapeRef(null, "H2T");
      expect(result[0]).toBe("helicopter");
      // Scale is normalised to 1.0 in the basic-letter fallback
      expect(result[1]).toBe(1.0);
    });

    test("resolves G1P (no exact match) → cessna via 'G' prefix (gyrocopter)", () => {
      const result = resolveShapeRef(null, "G1P");
      expect(result[0]).toBe("cessna");
      expect(result[1]).toBe(1.0);
    });
  });

  describe("Level 5: ADS-B emitter category", () => {
    test("resolves A3 category → airliner", () => {
      expect(resolveShapeRef(null, null, null, "A3")).toEqual(["airliner", 0.96]);
    });

    test("resolves B6 category → uav", () => {
      expect(resolveShapeRef(null, null, null, "B6")).toEqual(["uav", 1.0]);
    });

    test("resolves A7 category → helicopter", () => {
      expect(resolveShapeRef(null, null, null, "A7")).toEqual(["helicopter", 1.0]);
    });

    test("resolves category case-insensitively", () => {
      expect(resolveShapeRef(null, null, null, "a3")).toEqual(["airliner", 0.96]);
    });
  });

  describe("Level 6: unknown fallback", () => {
    test("returns unknown for unrecognised designator without description or category", () => {
      expect(resolveShapeRef("XXXX")).toEqual(["unknown", 1.0]);
    });

    test("returns unknown when all inputs are null", () => {
      expect(resolveShapeRef(null, null, null, null)).toEqual(["unknown", 1.0]);
    });

    test("returns unknown for unrecognised type description with no matching basic letter", () => {
      // "Z" is not in TypeDescriptionIcons
      expect(resolveShapeRef(null, "Z1P", null, null)).toEqual(["unknown", 1.0]);
    });
  });

  describe("unknown designator falls back to later levels", () => {
    test("Unrecognised designator falls back to category", () => {
      const result = resolveShapeRef("UNKN", null, null, "B2");
      expect(result[0]).toBe("balloon");
    });

    test("Unrecognised designator + description falls back to description", () => {
      const result = resolveShapeRef("UNKN", "L1P", null, null);
      expect(result[0]).toBe("cessna");
    });
  });
});

describe("resolveShape", () => {
  test("returns a valid ShapeDefinition from AircraftShapes for a known designator", () => {
    const { shape, scale } = resolveShape("B738");
    expect(shape).toBeDefined();
    expect(typeof shape.path === "string" || Array.isArray(shape.path)).toBe(true);
    expect(shape.viewBox).toBeTruthy();
    expect(scale).toBe(1.0);
  });

  test("returns the unknown shape for an unrecognised designator", () => {
    const { shape } = resolveShape("ZZZZ999");
    const unknownShape = AircraftShapes["unknown"];
    expect(shape).toEqual(unknownShape);
  });

  test("returns a non-null shape for every known category", () => {
    const categories = ["A1", "A3", "A5", "A7", "B1", "B2", "B6", "C0"];
    for (const cat of categories) {
      const { shape } = resolveShape(null, null, null, cat);
      expect(shape).toBeDefined();
    }
  });
});
