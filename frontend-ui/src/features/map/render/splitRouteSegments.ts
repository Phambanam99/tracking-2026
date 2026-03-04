type RoutePoint = {
  lat: number;
  lon: number;
  eventTime: number;
};

type SplitRouteOptions = {
  maxGapMs: number;
  maxSpeedKts: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(left: RoutePoint, right: RoutePoint): number {
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLon = toRadians(right.lon - left.lon);
  const leftLat = toRadians(left.lat);
  const rightLat = toRadians(right.lat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
    + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shouldSplitSegment(previous: RoutePoint, current: RoutePoint, options: SplitRouteOptions): boolean {
  const gapMs = current.eventTime - previous.eventTime;
  if (!Number.isFinite(gapMs) || gapMs <= 0) {
    return true;
  }

  if (gapMs > options.maxGapMs) {
    return true;
  }

  const distanceKm = haversineDistanceKm(previous, current);
  const speedKts = (distanceKm / (gapMs / 3_600_000)) * 0.539957;

  return speedKts > options.maxSpeedKts;
}

export function splitRouteSegments<T extends RoutePoint>(points: T[], options: SplitRouteOptions): T[][] {
  if (points.length < 2) {
    return points.length === 0 ? [] : [points];
  }

  const segments: T[][] = [];
  let currentSegment: T[] = [points[0]];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (shouldSplitSegment(previous, current, options)) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [current];
      continue;
    }

    currentSegment.push(current);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments.filter((segment) => segment.length > 0);
}
