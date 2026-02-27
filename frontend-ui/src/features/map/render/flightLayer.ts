export type FlightLayerPoint = {
  id: string;
  lat: number;
  lon: number;
};

export function toFlightLayerData(points: FlightLayerPoint[]): FlightLayerPoint[] {
  return points;
}
