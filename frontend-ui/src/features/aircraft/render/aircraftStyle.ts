import Icon from "ol/style/Icon";
import Style from "ol/style/Style";
import type { ShapeDefinition } from "../db/markers";

export type AircraftStyleOptions = {
  shape: ShapeDefinition;
  scale?: number;
  heading?: number | null;
  altitude?: number | null;
  isSelected?: boolean;
  opacity?: number;
  fillColor?: string;
  strokeColor?: string;
};

/** Altitude color thresholds (feet). */
const ALTITUDE_COLORS: Array<[number, string]> = [
  [0, "#808080"],      // ground
  [1000, "#00ff00"],   // very low
  [5000, "#00dd88"],
  [10000, "#00bbff"],
  [20000, "#0055ff"],
  [30000, "#aa00ff"],
  [40000, "#ff00aa"],
];

function altitudeColor(altFt: number | null | undefined): string {
  if (altFt == null) return "#cccccc";
  if (altFt <= 0) return "#808080";
  for (let i = ALTITUDE_COLORS.length - 1; i >= 0; i--) {
    if (altFt >= ALTITUDE_COLORS[i][0]) {
      return ALTITUDE_COLORS[i][1];
    }
  }
  return "#cccccc";
}

/**
 * Build an SVG data-URI string from a ShapeDefinition.
 *
 * @param shape    Shape to render
 * @param fill     Fill colour (CSS colour string)
 * @param stroke   Stroke colour
 * @param iconScale Overall icon scale factor
 */
export function buildSvgDataUri(
  shape: ShapeDefinition,
  fill: string,
  stroke: string,
  iconScale = 1.0,
): string {
  const strokeWidth = (2 * (shape.strokeScale ?? 1)).toFixed(2);
  const w = (shape.w * iconScale).toFixed(1);
  const h = (shape.h * iconScale).toFixed(1);

  const paths = Array.isArray(shape.path) ? shape.path : [shape.path];
  const pathEls = paths
    .map(
      (d, idx) =>
        idx === 0
          ? `<path paint-order="stroke" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" d="${d}"/>`
          : `<path fill="none" stroke="${stroke}" stroke-width="${(Number(strokeWidth) * 0.6).toFixed(2)}" d="${d}"/>`,
    )
    .join("");

  const svg = [
    `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"`,
    ` viewBox="${shape.viewBox}" width="${w}" height="${h}">`,
    `<g>${pathEls}</g>`,
    `</svg>`,
  ].join("");

  // btoa is available in all modern browsers and jsdom
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const ICON_BASE_SCALE = 0.6; // world-units scale fed to OL Icon

/**
 * Resolve the altitude band index for a given altitude value.
 * Matches the thresholds in {@link ALTITUDE_COLORS}.
 */
export function altitudeBandIndex(altFt: number | null | undefined): number {
  if (altFt == null) return -1;
  if (altFt <= 0) return 0;
  for (let i = ALTITUDE_COLORS.length - 1; i >= 0; i--) {
    if (altFt >= ALTITUDE_COLORS[i][0]) return i;
  }
  return -1;
}

// LRU-style cache for Style objects — avoids re-creating Icon+SVG for
// identical visual parameters, which eliminates icon flicker during playback.
const STYLE_CACHE_MAX = 512;
const styleCache = new Map<string, Style>();

function buildStyleCacheKey(
  viewBox: string,
  fill: string,
  stroke: string,
  iconScale: number,
  roundedHeading: number,
  noRotate: boolean,
  opacity: number,
): string {
  return `${viewBox}|${fill}|${stroke}|${iconScale}|${roundedHeading}|${noRotate}|${opacity}`;
}

/**
 * Create an OpenLayers {@link Style} for the given aircraft.
 *
 * Styles are cached by quantised visual parameters (heading rounded to the
 * nearest integer degree, altitude mapped to its colour band).  Returning
 * the **same object reference** for identical visuals prevents OpenLayers
 * from scheduling unnecessary re-renders (which cause icon flicker).
 */
export function createAircraftStyle(options: AircraftStyleOptions): Style {
  const {
    shape,
    scale = 1.0,
    heading,
    altitude,
    isSelected = false,
    opacity = 1.0,
    fillColor,
    strokeColor,
  } = options;

  const fill = isSelected ? "#ffdd00" : (fillColor ?? altitudeColor(altitude));
  const stroke = strokeColor ?? "#000000";

  // Quantise heading to integer degrees — sub-degree changes are invisible.
  const roundedHeading = heading != null ? Math.round(heading) % 360 : 0;
  const noRotate = !!shape.noRotate;

  const cacheKey = buildStyleCacheKey(
    shape.viewBox,
    fill,
    stroke,
    scale,
    roundedHeading,
    noRotate,
    opacity,
  );

  const cached = styleCache.get(cacheKey);
  if (cached) return cached;

  const src = buildSvgDataUri(shape, fill, stroke, scale);

  // Heading in degrees → radians.  OL Icon rotation is clockwise from north.
  const rotation = (roundedHeading * Math.PI) / 180;

  const icon = new Icon({
    src,
    anchor: [0.5, 0.5],
    anchorXUnits: "fraction",
    anchorYUnits: "fraction",
    scale: ICON_BASE_SCALE,
    opacity,
    rotation: noRotate ? 0 : rotation,
    rotateWithView: !noRotate,
  });

  const style = new Style({ image: icon });

  // Evict oldest entries when the cache is full.
  if (styleCache.size >= STYLE_CACHE_MAX) {
    const firstKey = styleCache.keys().next().value;
    if (firstKey !== undefined) styleCache.delete(firstKey);
  }
  styleCache.set(cacheKey, style);

  return style;
}

/** @internal — Visible only for unit tests. */
export function _resetStyleCacheForTesting(): void {
  styleCache.clear();
}
