export type TileSourceType = "osm" | "xyz" | "tms" | "wms" | "wmts" | "mvt";
export type ProviderCategory = "online" | "offline" | "custom";

export interface MapTileProvider {
  id: string;
  name: string;
  labelKey?: string;
  category: ProviderCategory;
  sourceType: TileSourceType;
  url?: string;

  wmsLayers?: string;
  wmsVersion?: string;
  wmsFormat?: string;

  wmtsLayer?: string;
  wmtsMatrixSet?: string;
  wmtsFormat?: string;
  wmtsStyle?: string;
  wmtsProjection?: string;
  wmtsTileSize?: number;
  wmtsMatrixIds?: string[];
  wmtsResolutions?: number[];

  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  crossOrigin?: string;
  isDefault?: boolean;
}
