import { describe, expect, test } from "vitest";
import { segmentShipVoyages } from "./segmentShipVoyages";

describe("segmentShipVoyages", () => {
  test("splits voyages when the history gap is 2 days or more", () => {
    const voyages = segmentShipVoyages([
      { mmsi: "574001230", lat: 10, lon: 106, speed: null, course: null, heading: null, navStatus: null, eventTime: 1_000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 10.1, lon: 106.1, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 11, lon: 107, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000 + 2 * 24 * 60 * 60 * 1000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 11.1, lon: 107.1, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000 + 2 * 24 * 60 * 60 * 1000 + 60_000, sourceId: "AIS" },
    ]);

    expect(voyages).toHaveLength(2);
    expect(voyages[0]?.startPoint.eventTime).toBe(2_000 + 2 * 24 * 60 * 60 * 1000);
    expect(voyages[0]?.endPoint.eventTime).toBe(2_000 + 2 * 24 * 60 * 60 * 1000 + 60_000);
    expect(voyages[1]?.startPoint.eventTime).toBe(1_000);
    expect(voyages[1]?.endPoint.eventTime).toBe(2_000);
  });

  test("returns a single voyage for continuous history", () => {
    const voyages = segmentShipVoyages([
      { mmsi: "574001230", lat: 10, lon: 106, speed: null, course: null, heading: null, navStatus: null, eventTime: 1_000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 10.1, lon: 106.1, speed: null, course: null, heading: null, navStatus: null, eventTime: 2_000, sourceId: "AIS" },
      { mmsi: "574001230", lat: 10.2, lon: 106.2, speed: null, course: null, heading: null, navStatus: null, eventTime: 3_000, sourceId: "AIS" },
    ]);

    expect(voyages).toHaveLength(1);
    expect(voyages[0]?.points).toHaveLength(3);
    expect(voyages[0]?.rangeFrom).toBe(1_000);
    expect(voyages[0]?.rangeTo).toBe(3_000);
  });
});
