import type { SocketFlight } from "../render/flightLayer";

export type FlightRefMap = Map<string, SocketFlight>;

const flightRefMap: FlightRefMap = new Map();

export function getFlightRefMap(): FlightRefMap {
  return flightRefMap;
}

export function upsertFlight(flight: SocketFlight): void {
  flightRefMap.set(flight.icao, flight);
}

export function removeFlight(icao: string): void {
  flightRefMap.delete(icao);
}

export function listFlights(): SocketFlight[] {
  return Array.from(flightRefMap.values());
}

export function clearFlights(): void {
  flightRefMap.clear();
}
