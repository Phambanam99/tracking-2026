import { httpRequest } from "../../../shared/api/httpClient";
import type { TrailPosition } from "../types/trailTypes";

type FlightPositionDto = {
  icao: string;
  lat: number;
  lon: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  eventTime: number;
  sourceId: string | null;
};

export async function fetchFlightHistory(
  icao: string,
  fromMs: number,
  toMs: number,
  limit = 2000,
): Promise<TrailPosition[]> {
  const params = new URLSearchParams({
    from: String(fromMs),
    to: String(toMs),
    limit: String(limit),
  });

  const data = await httpRequest<FlightPositionDto[]>({
    path: `/api/v1/aircraft/${icao}/history?${params.toString()}`,
    method: "GET",
  });

  return [...data]
    .sort((left, right) => left.eventTime - right.eventTime)
    .map((position) => ({
      lat: position.lat,
      lon: position.lon,
      altitude: position.altitude,
      heading: position.heading,
      eventTime: position.eventTime,
    }));
}
