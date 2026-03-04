import { describe, expect, test } from "vitest";
import { parseProviderConfig } from "./providerConfig";

describe("providerConfig", () => {
  test("parseProviderConfig parses valid provider entries", () => {
    const raw = JSON.stringify([
      {
        id: "custom-osm",
        name: "Custom OSM",
        category: "custom",
        sourceType: "osm",
      },
      {
        id: "custom-xyz",
        name: "Custom XYZ",
        category: "custom",
        sourceType: "xyz",
        url: "https://tiles.example.com/{z}/{x}/{y}.png",
      },
      {
        id: "custom-tms",
        name: "Custom TMS",
        category: "custom",
        sourceType: "tms",
        url: "https://tiles.example.com/{z}/{x}/{-y}.png",
      },
      {
        id: "custom-wms",
        name: "Custom WMS",
        category: "custom",
        sourceType: "wms",
        url: "https://wms.example.com/service",
        wmsLayers: "workspace:layer_name",
      },
      {
        id: "custom-wmts",
        name: "Custom WMTS",
        category: "custom",
        sourceType: "wmts",
        url: "https://wmts.example.com/service",
        wmtsLayer: "world-basemap",
        wmtsMatrixSet: "GoogleMapsCompatible",
      },
      {
        id: "custom-mvt",
        name: "Custom MVT",
        category: "custom",
        sourceType: "mvt",
        url: "https://tiles.example.com/{z}/{x}/{y}.pbf",
      },
    ]);

    const providers = parseProviderConfig(raw);

    expect(providers).toHaveLength(6);
    expect(providers[0]?.id).toBe("custom-osm");
    expect(providers[1]?.id).toBe("custom-xyz");
    expect(providers[2]?.id).toBe("custom-tms");
    expect(providers[3]?.id).toBe("custom-wms");
    expect(providers[4]?.id).toBe("custom-wmts");
    expect(providers[5]?.id).toBe("custom-mvt");
  });

  test("parseProviderConfig ignores invalid entries", () => {
    const raw = JSON.stringify([
      {
        id: "valid-osm",
        name: "Valid OSM",
        category: "online",
        sourceType: "osm",
      },
      {
        id: "invalid-xyz",
        name: "Invalid XYZ",
        category: "online",
        sourceType: "xyz",
      },
      {
        id: "invalid-wms",
        name: "Invalid WMS",
        category: "online",
        sourceType: "wms",
        url: "https://wms.example.com/service",
      },
      {
        id: "invalid-wmts",
        name: "Invalid WMTS",
        category: "online",
        sourceType: "wmts",
        url: "https://wmts.example.com/service",
        wmtsLayer: "world-basemap",
      },
      "invalid-item",
    ]);

    const providers = parseProviderConfig(raw);

    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe("valid-osm");
  });

  test("parseProviderConfig throws when JSON is not an array", () => {
    expect(() => parseProviderConfig("{}")).toThrowError(/must be a JSON array/i);
  });
});
