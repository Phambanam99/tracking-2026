import { describe, expect, test } from "vitest";
import TileLayer from "ol/layer/Tile";
import VectorTileLayer from "ol/layer/VectorTile";
import OSM from "ol/source/OSM";
import TileWMS from "ol/source/TileWMS";
import VectorTileSource from "ol/source/VectorTile";
import WMTS from "ol/source/WMTS";
import XYZ from "ol/source/XYZ";
import { createTileLayer, InvalidMapProviderError } from "./createTileLayer";

describe("createTileLayer", () => {
  test("creates OSM tile layer for osm provider", () => {
    const layer = createTileLayer({
      id: "osm",
      name: "OpenStreetMap",
      category: "online",
      sourceType: "osm",
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(OSM);
  });

  test("creates XYZ tile layer for xyz provider", () => {
    const layer = createTileLayer({
      id: "custom-xyz",
      name: "Custom XYZ",
      category: "custom",
      sourceType: "xyz",
      url: "https://tiles.example.com/{z}/{x}/{y}.png",
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(XYZ);
  });

  test("creates XYZ tile layer for tms provider", () => {
    const layer = createTileLayer({
      id: "custom-tms",
      name: "Custom TMS",
      category: "custom",
      sourceType: "tms",
      url: "https://tiles.example.com/{z}/{x}/{-y}.png",
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(XYZ);
  });

  test("creates TileWMS layer for wms provider", () => {
    const layer = createTileLayer({
      id: "custom-wms",
      name: "Custom WMS",
      category: "custom",
      sourceType: "wms",
      url: "https://wms.example.com/service",
      wmsLayers: "workspace:layer_name",
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(TileWMS);
  });

  test("creates WMTS tile layer for wmts provider", () => {
    const layer = createTileLayer({
      id: "custom-wmts",
      name: "Custom WMTS",
      category: "custom",
      sourceType: "wmts",
      url: "https://wmts.example.com/service",
      wmtsLayer: "world-basemap",
      wmtsMatrixSet: "GoogleMapsCompatible",
      maxZoom: 5,
    });

    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(WMTS);
  });

  test("creates VectorTile layer for mvt provider", () => {
    const layer = createTileLayer({
      id: "custom-mvt",
      name: "Custom MVT",
      category: "custom",
      sourceType: "mvt",
      url: "https://tiles.example.com/{z}/{x}/{y}.pbf",
    });

    expect(layer).toBeInstanceOf(VectorTileLayer);
    expect(layer.getSource()).toBeInstanceOf(VectorTileSource);
  });

  test("throws typed error when xyz provider is missing url", () => {
    expect(() =>
      createTileLayer({
        id: "bad-xyz",
        name: "Bad XYZ",
        category: "custom",
        sourceType: "xyz",
      }),
    ).toThrow(InvalidMapProviderError);
  });

  test("throws typed error when wms provider is missing layers", () => {
    expect(() =>
      createTileLayer({
        id: "bad-wms",
        name: "Bad WMS",
        category: "custom",
        sourceType: "wms",
        url: "https://wms.example.com/service",
      }),
    ).toThrow(InvalidMapProviderError);
  });

  test("throws typed error when wmts provider is missing matrix set", () => {
    expect(() =>
      createTileLayer({
        id: "bad-wmts",
        name: "Bad WMTS",
        category: "custom",
        sourceType: "wmts",
        url: "https://wmts.example.com/service",
        wmtsLayer: "world-basemap",
      }),
    ).toThrow(InvalidMapProviderError);
  });

  test("throws typed error when wmts resolutions and matrix ids mismatch", () => {
    expect(() =>
      createTileLayer({
        id: "bad-wmts-grid",
        name: "Bad WMTS Grid",
        category: "custom",
        sourceType: "wmts",
        url: "https://wmts.example.com/service",
        wmtsLayer: "world-basemap",
        wmtsMatrixSet: "GoogleMapsCompatible",
        wmtsResolutions: [100, 50],
        wmtsMatrixIds: ["0"],
      }),
    ).toThrow(InvalidMapProviderError);
  });

  test("throws typed error when mvt provider is missing url", () => {
    expect(() =>
      createTileLayer({
        id: "bad-mvt",
        name: "Bad MVT",
        category: "custom",
        sourceType: "mvt",
      }),
    ).toThrow(InvalidMapProviderError);
  });
});
