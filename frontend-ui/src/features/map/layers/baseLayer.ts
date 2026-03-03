import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";

export type BaseLayerType = "osm" | "satellite";
export type BaseLayer = TileLayer<OSM | XYZ>;

/**
 * Creates the default OSM raster tile layer.
 */
export function createOsmLayer(): TileLayer<OSM> {
  return new TileLayer({
    source: new OSM({
      attributions: [
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      ],
    }),
    zIndex: 0,
    preload: 4,
  });
}

/**
 * Creates a raster satellite imagery layer backed by Esri World Imagery tiles.
 */
export function createSatelliteLayer(): TileLayer<XYZ> {
  return new TileLayer({
    source: new XYZ({
      attributions:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      crossOrigin: "anonymous",
    }),
    zIndex: 0,
    preload: 2,
  });
}

/**
 * Returns a base layer by type.
 */
export function createBaseLayer(type: BaseLayerType = "osm"): BaseLayer {
  switch (type) {
    case "satellite":
      return createSatelliteLayer();
    case "osm":
    default:
      return createOsmLayer();
  }
}
