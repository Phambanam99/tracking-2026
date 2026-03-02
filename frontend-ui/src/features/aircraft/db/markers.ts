/**
 * Simplified aircraft SVG shape definitions for top-down map rendering.
 *
 * All shapes use a 32×32 coordinate space (viewBox "0 0 32 32").
 * Nose always points UP (toward y = 0) so that applying a heading rotation
 * in OpenLayers renders the aircraft pointing in the correct compass direction.
 *
 * Shape names match the keys used in typeDesignatorIcons.ts.
 */

export type ShapeDefinition = {
  /** SVG path data (d attribute). May be a single string or array of paths. */
  path: string | string[];
  /** SVG viewBox attribute */
  viewBox: string;
  /** Logical render width (used for scaling) */
  w: number;
  /** Logical render height */
  h: number;
  /** Stroke width multiplier (default 1) */
  strokeScale?: number;
  /** If true, do not rotate the icon by heading */
  noRotate?: boolean;
};

/**
 * Map of shape name → ShapeDefinition.
 * Ported and simplified from tar1090 html/markers.js (and some originals).
 * See: https://github.com/wiedehopf/tar1090 (MIT-compatible license)
 */
export const AircraftShapes: Record<string, ShapeDefinition> = {
  /** Generic narrowbody commercial airliner (A320, B737 family etc.) */
  airliner: {
    w: 32,
    h: 32,
    viewBox: "0 0 32 32",
    strokeScale: 0.8,
    path: "M16,1 L14.5,11 L2,17 L2,19 L14.5,16.5 L14,23 L10,25 L10,27 L14,26 L14,31 L18,31 L18,26 L22,27 L22,25 L18,23 L17.5,16.5 L30,19 L30,17 L17.5,11 Z",
  },

  /** Widebody twin-engine (A330, B767 etc.) */
  heavy_2e: {
    w: 34,
    h: 34,
    viewBox: "0 0 34 34",
    strokeScale: 0.8,
    path: "M17,1 L14.5,10 L0,16 L0,18.5 L14.5,16 L14,24 L9,26 L9,28 L14,27 L14,33 L20,33 L20,27 L25,28 L25,26 L20,24 L19.5,16 L34,18.5 L34,16 L19.5,10 Z",
  },

  /** Widebody four-engine (B747, A380-like shapes) */
  heavy_4e: {
    w: 36,
    h: 36,
    viewBox: "0 0 36 36",
    strokeScale: 0.8,
    path: "M18,1 L16,10 L0,16 L0,19 L7,17.5 L7,19.5 L0,19 L0,20 L14,17.5 L13.5,25 L8,27 L8,29 L13.5,28 L13.5,33 L18.5,33 L18.5,28 L24,29 L24,27 L18.5,25 L18,17.5 L32,20 L32,19 L29,19.5 L29,17.5 L36,19 L36,16 L20,10 Z",
  },

  /** Swept-wing small-medium jet (CRJ, Embraer regional, biz jets) */
  jet_swept: {
    w: 28,
    h: 28,
    viewBox: "0 0 28 28",
    strokeScale: 0.9,
    path: "M14,1 L12.5,10 L4,16 L4,18 L12.5,15.5 L12.5,22 L9,24 L9,25.5 L12.5,25 L13,28 L15,28 L15.5,25 L19,25.5 L19,24 L15.5,22 L15.5,15.5 L24,18 L24,16 L15.5,10 Z",
  },

  /** Straight-wing business jet (BE40, Learjet etc.) */
  jet_nonswept: {
    w: 24,
    h: 24,
    viewBox: "0 0 24 24",
    strokeScale: 0.9,
    path: "M12,1 L11,9 L2,18 L2,20 L11,16 L11,22 L8,23.5 L8,24 L11,23.5 L12,26 L13,23.5 L16,24 L16,23.5 L13,22 L13,16 L22,20 L22,18 L13,9 Z",
  },

  /** High-performance military jet (F-16, MiG etc.) delta/swept */
  hi_perf: {
    w: 28,
    h: 28,
    viewBox: "0 0 28 28",
    strokeScale: 1.0,
    path: "M14,1 L10,22 L12.5,19 L14,27 L15.5,19 L18,22 Z",
  },

  /** Single-engine piston aircraft (Cessna 172 etc.) */
  cessna: {
    w: 26,
    h: 26,
    viewBox: "0 0 26 26",
    strokeScale: 1.0,
    path: "M13,1 L12,10 L0,21 L0,23 L12,17 L13,26 L14,17 L26,23 L26,21 L14,10 Z",
  },

  /** Single turboprop (King Air, Pilatus PC-12 etc.) */
  single_turbo: {
    w: 26,
    h: 26,
    viewBox: "0 0 26 26",
    strokeScale: 1.0,
    path: "M13,0 L12,10 L0,19 L0,21 L12,17.5 L12,24 L9,25.5 L9,26 L12,25.5 L13,28 L14,25.5 L17,26 L17,25.5 L14,24 L14,17.5 L26,21 L26,19 L14,10 Z",
  },

  /** Small twin-engine piston (Piper Twin Comanche etc.) */
  twin_small: {
    w: 26,
    h: 26,
    viewBox: "0 0 26 26",
    strokeScale: 1.0,
    path: "M13,1 L12,10 L7,14 L7,15.5 L12,14 L12,22 L9,23.5 L9,25 L12,24.5 L12.5,26 L13.5,26 L14,24.5 L17,25 L17,23.5 L14,22 L14,14 L19,15.5 L19,14 L14,10 Z",
  },

  /** Large twin-engine turboprop (C-130 type, large twins) */
  twin_large: {
    w: 30,
    h: 30,
    viewBox: "0 0 30 30",
    strokeScale: 1.0,
    path: "M15,1 L13.5,10 L7,14.5 L7,16 L13.5,14.5 L13,23 L9,25 L9,27 L13,26 L13.5,30 L16.5,30 L17,26 L21,27 L21,25 L17,23 L16.5,14.5 L23,16 L23,14.5 L16.5,10 Z",
  },

  /** Helicopter (generic top-down view) */
  helicopter: {
    w: 30,
    h: 30,
    viewBox: "0 0 30 30",
    strokeScale: 1.0,
    path: [
      // Body
      "M15,6 L13,10 L8,13 L8,15 L13,14 L13,18 L10,21 L14,23 L13,28 L15,30 L17,28 L16,23 L20,21 L17,18 L17,14 L22,15 L22,13 L17,10 Z",
      // Tail rotor (horizontal bar at tail)
      "M12,29 L18,29",
    ],
  },

  /** UAV / unmanned drone */
  uav: {
    w: 28,
    h: 28,
    viewBox: "0 0 28 28",
    strokeScale: 0.9,
    path: "M14,2 L9,8 L2,5 L5,13 L0,14 L5,15 L2,23 L9,20 L14,26 L19,20 L26,23 L23,15 L28,14 L23,13 L26,5 L19,8 Z",
  },

  /** Glider / motorglider with long thin wings */
  glider: {
    w: 26,
    h: 26,
    viewBox: "0 0 26 26",
    strokeScale: 0.9,
    path: "M13,2 L12.5,13 L0,17 L0,18 L12.5,15 L12,22 L10,24 L10,25 L12,24.5 L13,26 L14,24.5 L16,25 L16,24 L14,22 L13.5,15 L26,18 L26,17 L13.5,13 Z",
  },

  /** Balloon — no rotation applied */
  balloon: {
    w: 16,
    h: 20,
    viewBox: "0 0 16 20",
    noRotate: true,
    path: "M8,0 a8,8,0,1,0,0.001,0 Z M6,15 L10,15 L10,19 L8,20 L6,19 Z M6,15 L10,15",
  },

  /** Airship / blimp — no rotation applied */
  blimp: {
    w: 22,
    h: 16,
    viewBox: "0 0 22 16",
    noRotate: true,
    path: "M11,0 a11,7,0,1,0,0.001,0 Z M9,13 L13,13 L13,15.5 L11,16 L9,15.5 Z",
  },

  /** 4-engine narrowbody (B707, DC-8 era) */
  b707: {
    w: 32,
    h: 32,
    viewBox: "0 0 32 32",
    strokeScale: 0.8,
    path: "M16,1 L14.5,11 L10.5,13.5 L10.5,15 L14.5,14 L13.5,23 L9,25 L9,27 L13.5,26 L13.5,31 L18.5,31 L18.5,26 L23,27 L23,25 L18.5,23 L17.5,14 L21.5,15 L21.5,13.5 L17.5,11 Z",
  },

  /** Unknown / default fallback (generic aircraft silhouette) */
  unknown: {
    w: 22,
    h: 22,
    viewBox: "-2.5 -2.5 22 22",
    path: "M 4.256,15.496 C 3.979,14.340 7.280,13.606 7.280,13.606 V 8.650 l -6,2 c -0.680,0 -1,-0.350 -1,-0.660 C 0.242,9.595 0.496,9.231 0.880,9.130 1.140,9 4.800,7 7.280,5.630 V 3 C 7.280,1.890 7.720,0.290 8.510,0.290 9.300,0.290 9.770,1.840 9.770,3 v 2.630 c 2.450,1.370 6.100,3.370 6.370,3.500 0.390,0.093 0.651,0.461 0.610,0.860 -0.050,0.310 -0.360,0.670 -1.050,0.670 l -5.930,-2 v 4.946 c 0,0 3.300,0.734 3.024,1.890 -0.331,1.384 -2.830,0.378 -4.254,0.378 -1.434,4.520e-4 -3.950,1.016 -4.284,-0.378 z",
  },

  /** Ground vehicle */
  ground_square: {
    w: 11,
    h: 11,
    viewBox: "0 0 16 16",
    noRotate: true,
    path: "M 4,4 H 12 V 12 H 4 Z",
  },
};
