import { describe, expect, test } from "vitest";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { createBaseLayer, createOsmLayer, createSatelliteLayer } from "./baseLayer";

describe("baseLayer", () => {
  test("createOsmLayer returns a TileLayer instance", () => {
    const layer = createOsmLayer();
    expect(layer).toBeInstanceOf(TileLayer);
  });

  test("createOsmLayer sets zIndex to 0", () => {
    const layer = createOsmLayer();
    expect(layer.getZIndex()).toBe(0);
  });

  test("createOsmLayer uses an OSM source", () => {
    const layer = createOsmLayer();
    expect(layer.getSource()).toBeInstanceOf(OSM);
  });

  test("createBaseLayer('osm') returns a TileLayer with OSM source", () => {
    const layer = createBaseLayer("osm");
    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(OSM);
  });

  test("createBaseLayer() defaults to OSM when type is omitted", () => {
    const layer = createBaseLayer();
    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(OSM);
  });

  test("createSatelliteLayer returns a TileLayer backed by XYZ imagery", () => {
    const layer = createSatelliteLayer();
    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(XYZ);
    expect(layer.getZIndex()).toBe(0);
  });

  test("createBaseLayer('satellite') returns a TileLayer with XYZ source", () => {
    const layer = createBaseLayer("satellite");
    expect(layer).toBeInstanceOf(TileLayer);
    expect(layer.getSource()).toBeInstanceOf(XYZ);
  });
});
