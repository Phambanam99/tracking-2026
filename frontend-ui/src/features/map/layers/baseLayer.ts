import type TileLayer from "ol/layer/Tile";
import type VectorTileLayer from "ol/layer/VectorTile";
import type OSM from "ol/source/OSM";
import type TileWMS from "ol/source/TileWMS";
import type VectorTileSource from "ol/source/VectorTile";
import type WMTS from "ol/source/WMTS";
import type XYZ from "ol/source/XYZ";
import { initializeMapProviders } from "../providers/initProviders";
import { createTileLayer } from "../providers/createTileLayer";
import { getOrDefault } from "../providers/registry";

export type BaseLayerType = "osm" | "satellite";
export type BaseLayer =
  | TileLayer<OSM | XYZ | TileWMS | WMTS>
  | VectorTileLayer<VectorTileSource>;

export const LEGACY_BASE_LAYER_TO_PROVIDER_ID: Record<BaseLayerType, string> = {
  osm: "osm",
  satellite: "esri-satellite",
};

initializeMapProviders();

export function resolveProviderIdFromLegacyBaseLayerType(type?: BaseLayerType): string {
  if (!type) {
    return LEGACY_BASE_LAYER_TO_PROVIDER_ID.osm;
  }
  return LEGACY_BASE_LAYER_TO_PROVIDER_ID[type] ?? LEGACY_BASE_LAYER_TO_PROVIDER_ID.osm;
}

/**
 * Creates the default OSM raster tile layer.
 */
export function createOsmLayer(): TileLayer<OSM> {
  return createBaseLayer("osm") as TileLayer<OSM>;
}

/**
 * Creates a raster satellite imagery layer backed by Esri World Imagery tiles.
 */
export function createSatelliteLayer(): TileLayer<XYZ> {
  return createBaseLayer("satellite") as TileLayer<XYZ>;
}

/**
 * Returns a base layer by type.
 */
export function createBaseLayer(type: BaseLayerType = "osm"): BaseLayer {
  const providerId = LEGACY_BASE_LAYER_TO_PROVIDER_ID[type] ?? LEGACY_BASE_LAYER_TO_PROVIDER_ID.osm;
  const selectedProvider = getOrDefault(providerId);

  try {
    return createTileLayer(selectedProvider);
  } catch (error) {
    console.warn(
      `[map/providers] Failed creating base layer for provider \"${selectedProvider.id}\". Falling back to default provider.`,
      error,
    );
    const fallbackProvider = getOrDefault();
    return createTileLayer(fallbackProvider);
  }
}

export function createBaseLayerByProviderId(providerId?: string): BaseLayer {
  const provider = getOrDefault(providerId);
  try {
    return createTileLayer(provider);
  } catch (error) {
    console.warn(
      `[map/providers] Failed creating layer for provider \"${provider.id}\". Falling back to default provider.`,
      error,
    );
    return createTileLayer(getOrDefault());
  }
}
