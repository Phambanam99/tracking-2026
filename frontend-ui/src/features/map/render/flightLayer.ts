export type FlightLayerPoint = {
  id: string;
  lat: number;
  lon: number;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
};

export type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const MIN_LAT = -89.999999;
const MAX_LAT = 89.999999;
const FULL_WORLD_WEST = -180;
const FULL_WORLD_EAST = 180;
const MIN_LONGITUDE_SPAN = 0.000001;

export type SocketFlight = {
  icao: string;
  lat: number;
  lon: number;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
};

export function toFlightLayerData(flights: SocketFlight[], viewport?: BoundingBox): FlightLayerPoint[] {
  const normalizedViewport = viewport ? normalizeBoundingBox(viewport) : undefined;
  return flights
    .filter((flight) => Number.isFinite(flight.lat) && Number.isFinite(flight.lon))
    .filter((flight) => isInsideViewport(flight, normalizedViewport))
    .map((flight) => ({
      id: flight.icao,
      lat: flight.lat,
      lon: flight.lon,
      heading: flight.heading ?? null,
      speed: flight.speed ?? null,
      altitude: flight.altitude ?? null,
    }));
}

export function normalizeBoundingBox(viewport: BoundingBox): BoundingBox {
  const south = clampLatitude(Math.min(viewport.south, viewport.north));
  const north = clampLatitude(Math.max(viewport.south, viewport.north));
  const west = normalizeLongitude(viewport.west);
  const east = normalizeLongitude(viewport.east);

  if (!Number.isFinite(west) || !Number.isFinite(east)) {
    return {
      north,
      south,
      west: FULL_WORLD_WEST,
      east: FULL_WORLD_EAST,
    };
  }

  if (east - west <= MIN_LONGITUDE_SPAN) {
    return {
      north,
      south,
      west: FULL_WORLD_WEST,
      east: FULL_WORLD_EAST,
    };
  }

  return {
    north,
    south,
    west,
    east,
  };
}

function isInsideViewport(flight: SocketFlight, viewport?: BoundingBox): boolean {
  if (!viewport) {
    return true;
  }
  return (
    flight.lat >= viewport.south &&
    flight.lat <= viewport.north &&
    flight.lon >= viewport.west &&
    flight.lon <= viewport.east
  );
}

function clampLatitude(value: number): number {
  return Math.max(MIN_LAT, Math.min(MAX_LAT, value));
}

function normalizeLongitude(value: number): number {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  if (normalized === -180 && value > 0) {
    return 180;
  }
  return normalized;
}
