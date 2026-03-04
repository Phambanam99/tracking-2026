import TileLayer from "ol/layer/Tile";
import VectorTileLayer from "ol/layer/VectorTile";
import MVT from "ol/format/MVT";
import OSM from "ol/source/OSM";
import TileWMS from "ol/source/TileWMS";
import VectorTileSource from "ol/source/VectorTile";
import WMTS from "ol/source/WMTS";
import XYZ from "ol/source/XYZ";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import { getTopLeft, getWidth } from "ol/extent";
import { get as getProjection } from "ol/proj";
import type { MapTileProvider } from "./types";

export class InvalidMapProviderError extends Error {
  readonly providerId: string;

  constructor(providerId: string, message: string) {
    super(message);
    this.name = "InvalidMapProviderError";
    this.providerId = providerId;
  }
}

export type ProviderTileLayer =
  | TileLayer<OSM | XYZ | TileWMS | WMTS>
  | VectorTileLayer<VectorTileSource>;

function createDefaultWmtsResolutions(maxZoom: number, projectionCode: string): number[] {
  const projection = getProjection(projectionCode);
  if (!projection) {
    throw new Error(`Projection \"${projectionCode}\" is not available.`);
  }

  const extent = projection.getExtent();
  if (!extent) {
    throw new Error(`Projection \"${projectionCode}\" has no extent.`);
  }

  const baseSize = getWidth(extent) / 256;
  return Array.from({ length: maxZoom + 1 }, (_, index) => baseSize / Math.pow(2, index));
}

function createDefaultWmtsMatrixIds(maxZoom: number): string[] {
  return Array.from({ length: maxZoom + 1 }, (_, index) => index.toString());
}

export function createTileLayer(provider: MapTileProvider): ProviderTileLayer {
  switch (provider.sourceType) {
    case "osm":
      return new TileLayer({
        source: new OSM({
          attributions: provider.attribution,
          crossOrigin: provider.crossOrigin,
          maxZoom: provider.maxZoom,
        }),
        zIndex: 0,
        preload: 4,
      });
    case "xyz":
    case "tms":
      if (!provider.url) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"url\" when sourceType is \"${provider.sourceType}\".`,
        );
      }

      return new TileLayer({
        source: new XYZ({
          attributions: provider.attribution,
          url: provider.url,
          minZoom: provider.minZoom,
          maxZoom: provider.maxZoom,
          crossOrigin: provider.crossOrigin,
        }),
        zIndex: 0,
        preload: 2,
      });
    case "wms":
      if (!provider.url) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"url\" when sourceType is \"wms\".`,
        );
      }

      if (!provider.wmsLayers) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"wmsLayers\" when sourceType is \"wms\".`,
        );
      }

      return new TileLayer({
        source: new TileWMS({
          attributions: provider.attribution,
          url: provider.url,
          params: {
            LAYERS: provider.wmsLayers,
            VERSION: provider.wmsVersion ?? "1.3.0",
            FORMAT: provider.wmsFormat ?? "image/png",
            TILED: true,
          },
          crossOrigin: provider.crossOrigin,
        }),
        zIndex: 0,
        preload: 2,
      });
    case "wmts": {
      if (!provider.url) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"url\" when sourceType is \"wmts\".`,
        );
      }

      if (!provider.wmtsLayer) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"wmtsLayer\" when sourceType is \"wmts\".`,
        );
      }

      if (!provider.wmtsMatrixSet) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"wmtsMatrixSet\" when sourceType is \"wmts\".`,
        );
      }

      if ((provider.wmtsResolutions && !provider.wmtsMatrixIds) || (!provider.wmtsResolutions && provider.wmtsMatrixIds)) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" must provide both \"wmtsResolutions\" and \"wmtsMatrixIds\" together.`,
        );
      }

      const projectionCode = provider.wmtsProjection ?? "EPSG:3857";
      const projection = getProjection(projectionCode);
      if (!projection) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" uses unknown WMTS projection \"${projectionCode}\".`,
        );
      }

      const projectionExtent = projection.getExtent();
      if (!projectionExtent) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" projection \"${projectionCode}\" has no extent.`,
        );
      }

      const maxZoom = provider.maxZoom ?? 19;
      const resolutions = provider.wmtsResolutions ?? createDefaultWmtsResolutions(maxZoom, projectionCode);
      const matrixIds = provider.wmtsMatrixIds ?? createDefaultWmtsMatrixIds(maxZoom);

      if (resolutions.length !== matrixIds.length) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" has mismatched WMTS resolutions and matrix ids.`,
        );
      }

      return new TileLayer({
        source: new WMTS({
          attributions: provider.attribution,
          url: provider.url,
          layer: provider.wmtsLayer,
          matrixSet: provider.wmtsMatrixSet,
          format: provider.wmtsFormat ?? "image/png",
          projection: projectionCode,
          style: provider.wmtsStyle ?? "default",
          tileGrid: new WMTSTileGrid({
            origin: getTopLeft(projectionExtent),
            resolutions,
            matrixIds,
            tileSize: provider.wmtsTileSize ?? 256,
          }),
          crossOrigin: provider.crossOrigin,
        }),
        zIndex: 0,
        preload: 2,
      });
    }
    case "mvt":
      if (!provider.url) {
        throw new InvalidMapProviderError(
          provider.id,
          `Provider \"${provider.id}\" requires \"url\" when sourceType is \"mvt\".`,
        );
      }

      return new VectorTileLayer({
        source: new VectorTileSource({
          attributions: provider.attribution,
          format: new MVT(),
          url: provider.url,
          minZoom: provider.minZoom,
          maxZoom: provider.maxZoom,
        }),
        zIndex: 0,
      });
    default:
      throw new InvalidMapProviderError(
        provider.id,
        `Unsupported source type \"${String(provider.sourceType)}\" for provider \"${provider.id}\".`,
      );
  }
}
