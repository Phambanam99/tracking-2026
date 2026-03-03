import { describe, expect, test } from "vitest";
import { buildPlaybackFrames } from "./buildPlaybackFrames";

describe("buildPlaybackFrames", () => {
  test("groups viewport events into chronological frames and loads enrichment metadata", async () => {
    const frames = await buildPlaybackFrames(
      [
        {
          icao: "F00DBA",
          lat: 10,
          lon: 106,
          eventTime: new Date("2026-03-02T10:00:05Z").getTime(),
        },
        {
          icao: "BBB222",
          lat: 11,
          lon: 107,
          eventTime: new Date("2026-03-02T10:00:06Z").getTime(),
        },
        {
          icao: "AAA111",
          lat: 10.5,
          lon: 106.5,
          eventTime: new Date("2026-03-02T10:00:12Z").getTime(),
        },
      ],
      "2026-03-02T10:00",
      "2026-03-02T10:30",
    );

    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0]?.aircraft.map((aircraft) => aircraft.icao)).toContain("F00DBA");
    expect(frames[0]?.aircraft.map((aircraft) => aircraft.icao)).toContain("BBB222");
    expect(frames[0]?.aircraft.find((aircraft) => aircraft.icao === "F00DBA")?.operator).toBe("Seed Demo Air");
    expect(frames[frames.length - 1]?.aircraft.find((aircraft) => aircraft.icao === "AAA111")?.lat).toBe(10.5);
  });
});
