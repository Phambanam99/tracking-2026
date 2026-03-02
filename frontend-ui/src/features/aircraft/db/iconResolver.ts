import { AircraftShapes, type ShapeDefinition } from "./markers";
import {
  CategoryIcons,
  TypeDescriptionIcons,
  TypeDesignatorIcons,
  type ShapeRef,
} from "./typeDesignatorIcons";

/**
 * Resolve the best shape for an aircraft via a 4-level fallback:
 *
 * 1. ICAO type designator (e.g. "B738") → TypeDesignatorIcons
 * 2. ICAO type description + WTC (e.g. "L2J-M") → TypeDescriptionIcons
 * 3. ICAO type description (e.g. "L2J") → TypeDescriptionIcons
 * 4. Basic type letter (e.g. "H") → TypeDescriptionIcons
 * 5. ADS-B emitter category (e.g. "A3") → CategoryIcons
 * 6. "unknown" fallback
 *
 * @param typeDesignator ICAO type code, e.g. "B738"
 * @param typeDescription ICAO description code, e.g. "L2J"
 * @param wtc Wake turbulence category ("L", "M", "H", or null)
 * @param category ADS-B emitter category, e.g. "A3"
 */
export function resolveShapeRef(
  typeDesignator?: string | null,
  typeDescription?: string | null,
  wtc?: string | null,
  category?: string | null,
): ShapeRef {
  // 1. Type designator match
  if (typeDesignator) {
    const upper = typeDesignator.toUpperCase();
    if (upper in TypeDesignatorIcons) {
      return TypeDesignatorIcons[upper];
    }
  }

  // 2‒4. Type description fallback
  if (typeDescription && typeDescription.length >= 1) {
    const desc = typeDescription.toUpperCase();

    // 2. Full description + WTC (5-char key)
    if (wtc && wtc.length === 1) {
      const key = `${desc}-${wtc.toUpperCase()}`;
      if (key in TypeDescriptionIcons) {
        return TypeDescriptionIcons[key];
      }
    }

    // 3. Full description (3-char key)
    if (desc in TypeDescriptionIcons) {
      return TypeDescriptionIcons[desc];
    }

    // 4. Basic type letter (single char)
    const basicType = desc.charAt(0);
    if (basicType in TypeDescriptionIcons) {
      return [TypeDescriptionIcons[basicType][0], 1.0];
    }
  }

  // 5. ADS-B emitter category
  if (category && category.toUpperCase() in CategoryIcons) {
    return CategoryIcons[category.toUpperCase()];
  }

  // 6. Default fallback
  return ["unknown", 1.0];
}

/**
 * Resolve the ShapeDefinition for a given typeDesignator.
 * Calls resolveShapeRef then looks up the shape in AircraftShapes.
 * Always returns a valid ShapeDefinition (falls back to "unknown").
 */
export function resolveShape(
  typeDesignator?: string | null,
  typeDescription?: string | null,
  wtc?: string | null,
  category?: string | null,
): { shape: ShapeDefinition; scale: number } {
  const [shapeName, scale] = resolveShapeRef(
    typeDesignator,
    typeDescription,
    wtc,
    category,
  );

  const shape = AircraftShapes[shapeName] ?? AircraftShapes["unknown"];
  return { shape, scale };
}
