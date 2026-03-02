/**
 * Maps ICAO aircraft type designators (e.g. "B738") and ICAO type description
 * codes (e.g. "L2J") to shape names used in markers.ts.
 *
 * Ported from tar1090 html/markers.js TypeDesignatorIcons / TypeDescriptionIcons
 * / CategoryIcons.  Original source: https://github.com/wiedehopf/tar1090
 *
 * Format: [shapeName, scaleMultiplier]
 */

export type ShapeRef = [shapeName: string, scale: number];

/** Maps ICAO aircraft type designator → [shapeName, scale] */
export const TypeDesignatorIcons: Record<string, ShapeRef> = {
  // ── Airbus A320 family ──────────────────────────────────────────────────────
  A318: ["airliner", 0.95],
  A319: ["airliner", 1.0],
  A19N: ["airliner", 1.0],
  A320: ["airliner", 1.0],
  A20N: ["airliner", 1.0],
  A321: ["airliner", 1.0],
  A21N: ["airliner", 1.0],

  // ── Airbus widebody ─────────────────────────────────────────────────────────
  A306: ["heavy_2e", 0.93],
  A310: ["heavy_2e", 0.93],
  A330: ["heavy_2e", 0.98],
  A332: ["heavy_2e", 0.99],
  A333: ["heavy_2e", 1.0],
  A338: ["heavy_2e", 1.0],
  A339: ["heavy_2e", 1.01],
  A359: ["heavy_2e", 1.0],
  A35K: ["heavy_2e", 1.02],
  A388: ["heavy_4e", 1.0],
  A225: ["heavy_4e", 1.1],
  A124: ["b707", 1.18],
  A400: ["twin_large", 1.1],

  // ── Boeing widebody ─────────────────────────────────────────────────────────
  B762: ["heavy_2e", 0.91],
  B763: ["heavy_2e", 0.95],
  B764: ["heavy_2e", 0.97],
  B772: ["heavy_2e", 1.0],
  B773: ["heavy_2e", 1.02],
  B77L: ["heavy_2e", 1.03],
  B77W: ["heavy_2e", 1.03],
  B778: ["heavy_2e", 1.03],
  B779: ["heavy_2e", 1.04],
  B788: ["heavy_2e", 0.98],
  B789: ["heavy_2e", 1.0],
  B78X: ["heavy_2e", 1.01],

  // ── Boeing 747 ──────────────────────────────────────────────────────────────
  B741: ["heavy_4e", 0.96],
  B742: ["heavy_4e", 0.96],
  B743: ["heavy_4e", 0.96],
  B744: ["heavy_4e", 1.0],
  B74D: ["heavy_4e", 0.96],
  B74S: ["heavy_4e", 0.96],
  B74R: ["heavy_4e", 0.96],
  BLCF: ["heavy_4e", 1.0],

  // ── Boeing 737 family ───────────────────────────────────────────────────────
  B731: ["airliner", 0.9],
  B732: ["airliner", 0.92],
  B733: ["airliner", 0.96],
  B734: ["airliner", 0.98],
  B735: ["airliner", 0.96],
  B736: ["airliner", 0.98],
  B737: ["airliner", 1.0],
  B738: ["airliner", 1.0],
  B739: ["airliner", 1.02],
  B37M: ["airliner", 0.96],
  B38M: ["airliner", 1.0],
  B39M: ["airliner", 1.02],
  B3XM: ["airliner", 1.0],

  // ── Boeing 707/727/757 ──────────────────────────────────────────────────────
  B703: ["b707", 1.0],
  B712: ["jet_swept", 1.06],
  B721: ["jet_swept", 1.1],
  B722: ["jet_swept", 1.1],
  B752: ["airliner", 1.0],
  B753: ["airliner", 1.02],

  // ── Airbus A220 / Bombardier C-Series ───────────────────────────────────────
  BCS1: ["airliner", 0.835],
  BCS3: ["airliner", 0.85],

  // ── McDonnell Douglas ───────────────────────────────────────────────────────
  DC10: ["heavy_2e", 0.95],
  MD11: ["heavy_2e", 0.96],
  DC91: ["jet_swept", 1.0],
  DC92: ["jet_swept", 1.0],
  DC93: ["jet_swept", 1.0],
  DC94: ["jet_swept", 1.0],
  DC95: ["jet_swept", 1.0],
  MD80: ["jet_swept", 1.06],
  MD81: ["jet_swept", 1.06],
  MD82: ["jet_swept", 1.06],
  MD83: ["jet_swept", 1.06],
  MD87: ["jet_swept", 1.06],
  MD88: ["jet_swept", 1.06],
  MD90: ["jet_swept", 1.06],

  // ── Embraer ─────────────────────────────────────────────────────────────────
  E135: ["jet_swept", 0.88],
  E145: ["jet_swept", 0.9],
  E170: ["airliner", 0.82],
  E75S: ["airliner", 0.82],
  E75L: ["airliner", 0.82],
  E190: ["airliner", 0.81],
  E195: ["airliner", 0.81],
  E290: ["airliner", 0.82],
  E295: ["airliner", 0.83],
  E390: ["airliner", 0.84],
  E45X: ["jet_swept", 0.92],
  CRJ1: ["jet_swept", 0.92],
  CRJ2: ["jet_swept", 0.92],
  CRJ7: ["jet_swept", 0.94],
  CRJ9: ["jet_swept", 0.96],
  CRJX: ["jet_swept", 0.98],
  F100: ["jet_swept", 1.0],
  F70:  ["jet_swept", 0.97],
  F28:  ["jet_swept", 0.93],

  // ── Smaller airliners (ATR, Dash-8, Fokker etc.) ────────────────────────────
  AT43: ["twin_large", 0.86],
  AT44: ["twin_large", 0.88],
  AT45: ["twin_large", 0.88],
  AT46: ["twin_large", 0.88],
  AT72: ["twin_large", 0.94],
  AT73: ["twin_large", 0.94],
  AT75: ["twin_large", 0.96],
  AT76: ["twin_large", 0.96],
  DH8A: ["twin_large", 0.84],
  DH8B: ["twin_large", 0.88],
  DH8C: ["twin_large", 0.9],
  DH8D: ["twin_large", 0.96],

  // ── Generic airliner (medium, 38–70 t) ──────────────────────────────────────
  J328: ["airliner", 0.78],
  A148: ["airliner", 0.83],
  RJ70: ["b707", 0.68],
  RJ85: ["b707", 0.68],
  RJ1H: ["b707", 0.68],
  B461: ["b707", 0.68],
  B462: ["b707", 0.68],
  B463: ["b707", 0.68],
  T154: ["jet_swept", 1.12],

  // ── Business jets (straight-wing) ───────────────────────────────────────────
  BE40: ["jet_nonswept", 1.0],
  FA10: ["jet_nonswept", 1.0],
  C501: ["jet_nonswept", 1.0],
  C510: ["jet_nonswept", 1.0],
  C525: ["jet_nonswept", 1.0],
  C550: ["jet_nonswept", 1.0],
  C560: ["jet_nonswept", 1.0],
  C56X: ["jet_nonswept", 1.0],
  C25A: ["jet_nonswept", 1.0],
  C25B: ["jet_nonswept", 1.0],
  C25C: ["jet_nonswept", 1.0],
  LJ23: ["jet_nonswept", 1.0],
  LJ24: ["jet_nonswept", 1.0],
  LJ25: ["jet_nonswept", 1.0],
  LJ31: ["jet_nonswept", 1.0],
  HDJT: ["jet_nonswept", 0.96],
  SF50: ["jet_nonswept", 0.94],

  // ── Turboprop transports ─────────────────────────────────────────────────────
  C130: ["twin_large", 1.07],
  C30J: ["twin_large", 1.07],
  P3:   ["twin_large", 1.0],
  WB57: ["twin_large", 0.9],

  // ── High performance military ────────────────────────────────────────────────
  A37:  ["hi_perf", 1.0],
  T38:  ["hi_perf", 1.0],
  F104: ["hi_perf", 1.0],
  A10:  ["hi_perf", 1.0],
  EUFI: ["hi_perf", 1.0],
  SB39: ["hi_perf", 1.0],
  MIR2: ["hi_perf", 1.0],
  KFIR: ["hi_perf", 1.0],
  F1:   ["hi_perf", 1.0],
  F14:  ["hi_perf", 1.0],
  F15:  ["hi_perf", 1.0],
  F16:  ["hi_perf", 1.0],
  F18:  ["hi_perf", 1.0],
  F18H: ["hi_perf", 1.0],
  F18S: ["hi_perf", 1.0],
  F22:  ["hi_perf", 1.0],
  F22A: ["hi_perf", 1.0],
  F35:  ["hi_perf", 1.0],
  F4:   ["hi_perf", 1.0],
  F5:   ["hi_perf", 1.0],

  // ── Helicopter types ─────────────────────────────────────────────────────────
  H60:  ["helicopter", 1.0],
  S92:  ["helicopter", 1.0],
  NH90: ["helicopter", 1.0],
  H64:  ["helicopter", 1.0],
  AS32: ["helicopter", 1.0],
  AS3B: ["helicopter", 1.0],
  PUMA: ["helicopter", 1.0],
  MI24: ["helicopter", 1.0],
  AS65: ["helicopter", 0.85],
  S76:  ["helicopter", 0.86],
  GAZL: ["helicopter", 1.0],
  AS50: ["helicopter", 1.0],
  AS55: ["helicopter", 1.0],
  EC25: ["helicopter", 1.0],
  EH10: ["helicopter", 1.0],
  H53:  ["helicopter", 1.1],
  H53S: ["helicopter", 1.1],
  H47:  ["helicopter", 1.0],
  H46:  ["helicopter", 1.0],
  S61:  ["helicopter", 1.0],
  S65:  ["helicopter", 1.0],
  TIGR: ["helicopter", 1.0],

  // ── UAV ──────────────────────────────────────────────────────────────────────
  DRON: ["uav", 1.0],
  Q1:   ["uav", 1.0],
  Q4:   ["uav", 1.0],
  Q9:   ["uav", 1.0],
  Q25:  ["uav", 1.0],
  HRON: ["uav", 1.0],
  MQ9:  ["uav", 1.0],
  RQ4:  ["uav", 1.0],

  // ── Gliders ──────────────────────────────────────────────────────────────────
  GLID: ["glider", 1.0],

  // ── Special / airships ───────────────────────────────────────────────────────
  SHIP: ["blimp", 0.94],
  BALL: ["balloon", 1.0],

  // ── Light GA (Cessna, Piper, etc.) ───────────────────────────────────────────
  C172: ["cessna", 1.0],
  C182: ["cessna", 1.0],
  C152: ["cessna", 0.9],
  PA28: ["cessna", 1.0],
  PA18: ["cessna", 0.9],
  C208: ["single_turbo", 1.0],
  PC12: ["single_turbo", 1.0],
  TBM7: ["single_turbo", 1.0],
  TBM8: ["single_turbo", 1.0],
  TBM9: ["single_turbo", 1.0],
  SR20: ["cessna", 1.0],
  SR22: ["cessna", 1.0],

  // ── Light twin ──────────────────────────────────────────────────────────────
  BE20: ["twin_small", 0.92],
  BE58: ["twin_small", 0.88],
  PA31: ["twin_small", 0.9],
  PA34: ["twin_small", 0.88],

  // ── Ground ──────────────────────────────────────────────────────────────────
  GND:  ["ground_square", 1.0],
  GRND: ["ground_square", 1.0],
};

/**
 * Maps ICAO type description codes (e.g. "L2J") → [shapeName, scale].
 * Used as fallback when the type designator is not in TypeDesignatorIcons.
 *
 * Key formats:
 *  - Single char: basic type letter (e.g. "H" = helicopter)
 *  - 3 chars: ICAO description (e.g. "L2J")
 *  - 5 chars: description + WTC (e.g. "L2J-M")
 */
export const TypeDescriptionIcons: Record<string, ShapeRef> = {
  // Single-character basic type
  H: ["helicopter", 1.0],
  G: ["cessna", 1.0], // gyrocopter — use small prop shape

  // Landplane variants
  L1P: ["cessna", 1.0],
  A1P: ["cessna", 1.0],
  L1T: ["single_turbo", 1.0],
  L1J: ["hi_perf", 0.92],

  L2P: ["twin_small", 1.0],
  A2P: ["twin_small", 1.0],
  L2T: ["twin_large", 0.9],
  L2J: ["jet_swept", 1.0],
  "L2J-M": ["jet_swept", 1.0],
  "L2J-H": ["heavy_2e", 0.9],

  L3J: ["heavy_2e", 0.95],
  L4T: ["twin_large", 0.96],
  "L4J-H": ["heavy_4e", 1.0],
  "L4J-M": ["b707", 0.8],
  L4J: ["b707", 0.8],
};

/**
 * Maps ADS-B emitter category codes → [shapeName, scale].
 */
export const CategoryIcons: Record<string, ShapeRef> = {
  A1: ["cessna", 1.0],      // < 7t light
  A2: ["jet_swept", 0.94],  // < 34t small
  A3: ["airliner", 0.96],   // < 136t medium
  A4: ["airliner", 1.0],    // < 136t medium-large
  A5: ["heavy_2e", 0.92],   // > 136t heavy
  A6: ["hi_perf", 0.94],    // high vortex / performance
  A7: ["helicopter", 1.0],  // rotorcraft
  B1: ["glider", 1.0],      // glider / sailplane
  B2: ["balloon", 1.0],     // lighter-than-air
  B4: ["cessna", 0.85],     // ultralight
  B6: ["uav", 1.0],         // unmanned aerial vehicle
  C0: ["ground_square", 1.0],
  C1: ["ground_square", 1.0],
  C2: ["ground_square", 1.0],
  C3: ["ground_square", 1.0],
};
