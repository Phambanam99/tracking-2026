import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";

export type BaseLayerType = "osm" | "satellite";

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
 * Returns a base layer by type.  
 * Currently only "osm" is supported – satellite will be added in a later phase.
 */
export function createBaseLayer(type: BaseLayerType = "osm"): TileLayer<OSM> {
  switch (type) {
    case "osm":
    default:
      return createOsmLayer();
  }
}
