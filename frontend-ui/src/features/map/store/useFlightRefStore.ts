export type FlightRefMap = Map<string, unknown>;

const flightRefMap: FlightRefMap = new Map();

export function getFlightRefMap(): FlightRefMap {
  return flightRefMap;
}
