import type { ShipHistoryPoint } from "../api/shipSearchApi";

export const DEFAULT_SHIP_VOYAGE_GAP_MS = 2 * 24 * 60 * 60 * 1000;

export type ShipVoyage = {
  key: string;
  mmsi: string;
  startPoint: ShipHistoryPoint;
  endPoint: ShipHistoryPoint;
  points: ShipHistoryPoint[];
  rangeFrom: number;
  rangeTo: number;
};

type SegmentShipVoyagesOptions = {
  maxGapMs?: number;
};

function buildVoyageKey(mmsi: string, startTime: number, endTime: number): string {
  return `voyage:${mmsi}:${startTime}:${endTime}`;
}

export function segmentShipVoyages(
  points: ShipHistoryPoint[],
  options: SegmentShipVoyagesOptions = {},
): ShipVoyage[] {
  if (points.length === 0) {
    return [];
  }

  const maxGapMs = options.maxGapMs ?? DEFAULT_SHIP_VOYAGE_GAP_MS;
  const sortedPoints = points.slice().sort((left, right) => left.eventTime - right.eventTime);
  const voyages: ShipVoyage[] = [];
  let currentPoints: ShipHistoryPoint[] = [sortedPoints[0]];

  for (let index = 1; index < sortedPoints.length; index += 1) {
    const previousPoint = sortedPoints[index - 1];
    const currentPoint = sortedPoints[index];
    if (!previousPoint || !currentPoint) {
      continue;
    }

    if (currentPoint.eventTime - previousPoint.eventTime >= maxGapMs) {
      const startPoint = currentPoints[0];
      const endPoint = currentPoints[currentPoints.length - 1];
      if (startPoint && endPoint) {
        voyages.push({
          key: buildVoyageKey(startPoint.mmsi, startPoint.eventTime, endPoint.eventTime),
          mmsi: startPoint.mmsi,
          startPoint,
          endPoint,
          points: currentPoints,
          rangeFrom: startPoint.eventTime,
          rangeTo: endPoint.eventTime,
        });
      }
      currentPoints = [currentPoint];
      continue;
    }

    currentPoints.push(currentPoint);
  }

  const startPoint = currentPoints[0];
  const endPoint = currentPoints[currentPoints.length - 1];
  if (startPoint && endPoint) {
    voyages.push({
      key: buildVoyageKey(startPoint.mmsi, startPoint.eventTime, endPoint.eventTime),
      mmsi: startPoint.mmsi,
      startPoint,
      endPoint,
      points: currentPoints,
      rangeFrom: startPoint.eventTime,
      rangeTo: endPoint.eventTime,
    });
  }

  return voyages.slice().reverse();
}
