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

export type SocketFlight = {
  icao: string;
  lat: number;
  lon: number;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
};

export function toFlightLayerData(flights: SocketFlight[], viewport?: BoundingBox): FlightLayerPoint[] {
  return flights
    .filter((flight) => Number.isFinite(flight.lat) && Number.isFinite(flight.lon))
    .filter((flight) => isInsideViewport(flight, viewport))
    .map((flight) => ({
      id: flight.icao,
      lat: flight.lat,
      lon: flight.lon,
      heading: flight.heading ?? null,
      speed: flight.speed ?? null,
      altitude: flight.altitude ?? null,
    }));
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
