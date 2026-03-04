import { describe, expect, test } from "vitest";
import { splitRouteSegments } from "./splitRouteSegments";

describe("splitRouteSegments", () => {
  test("splits routes on large time gaps", () => {
    const segments = splitRouteSegments(
      [
        { lat: 10, lon: 106, eventTime: 0 },
        { lat: 10.1, lon: 106.1, eventTime: 60_000 },
        { lat: 10.2, lon: 106.2, eventTime: 5_000_000 },
      ],
      { maxGapMs: 120_000, maxSpeedKts: 1200 },
    );

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(2);
    expect(segments[1]).toHaveLength(1);
  });

  test("splits routes on implausible jumps", () => {
    const segments = splitRouteSegments(
      [
        { lat: 10, lon: 106, eventTime: 0 },
        { lat: 30, lon: 140, eventTime: 60_000 },
      ],
      { maxGapMs: 120_000, maxSpeedKts: 100 },
    );

    expect(segments).toHaveLength(2);
  });
});
