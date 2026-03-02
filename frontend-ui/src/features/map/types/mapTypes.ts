/**
 * Shared map types used across map feature modules.
 */

/** Geographic extent in WGS-84 (EPSG:4326). */
export type LonLatExtent = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Map center + zoom level in geographic coordinates. */
export type MapViewport = {
  /** [longitude, latitude] in EPSG:4326 */
  center: [number, number];
  zoom: number;
};

/** Default viewport: Indochina / Southeast Asia */
export const DEFAULT_VIEWPORT: MapViewport = {
  center: [107.5, 16.0],
  zoom: 6,
};
