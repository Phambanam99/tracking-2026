import { beforeEach, describe, expect, test } from "vitest";
import {
  loadAircraftDbEntry,
  lookupAircraftDbEntry,
  preloadAircraftDbEntry,
  resetAircraftDbCache,
} from "./aircraftDb";

describe("aircraftDb", () => {
  beforeEach(() => {
    resetAircraftDbCache();
  });

  test("returns null synchronously before a shard has been loaded", () => {
    expect(lookupAircraftDbEntry("F00DBA")).toBeNull();
  });

  test("loads a shard lazily and exposes cached lookups afterwards", async () => {
    preloadAircraftDbEntry("F00DBA");

    const entry = await loadAircraftDbEntry("F00DBA");
    expect(entry).toEqual({
      registration: "N42DB",
      aircraftType: "A21N",
      operator: "Seed Demo Air",
      countryCode: "US",
      countryFlagUrl: "https://flagcdn.com/h80/us.png",
    });

    expect(lookupAircraftDbEntry("F00DBA")).toEqual(entry);
  });

  test("returns null for unknown or invalid ICAOs", async () => {
    expect(await loadAircraftDbEntry("BAD")).toBeNull();
    expect(await loadAircraftDbEntry("A00001")).toBeNull();
  });
});
