import { describe, expect, test } from "vitest";
import { toFlightLayerData } from "./flightLayer";

describe("toFlightLayerData", () => {
  test("should filter invalid coordinates and map fields", () => {
    const points = toFlightLayerData([
      { icao: "ABC123", lat: 21.0, lon: 105.0, speed: 450 },
      { icao: "BAD", lat: Number.NaN, lon: 105.0 },
    ]);

    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({
      id: "ABC123",
      lat: 21.0,
      lon: 105.0,
      heading: null,
      speed: 450,
      altitude: null,
    });
  });

  test("should respect viewport bounds", () => {
    const points = toFlightLayerData(
      [
        { icao: "IN", lat: 21.0, lon: 105.5 },
        { icao: "OUT", lat: 30.0, lon: 110.0 },
      ],
      {
        north: 22,
        south: 20,
        east: 106,
        west: 105,
      },
    );

    expect(points.map((point) => point.id)).toEqual(["IN"]);
  });
});
