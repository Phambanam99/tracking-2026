import { httpRequest } from "../../../shared/api/httpClient";
import type { BoundingBox } from "../../map/render/flightLayer";
import type { Aircraft } from "../types/aircraftTypes";

type LiveAircraftDto = {
  icao: string;
  lat: number;
  lon: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  eventTime: number;
  sourceId: string | null;
  registration: string | null;
  aircraftType: string | null;
  operator: string | null;
  isMilitary?: boolean;
};

export async function fetchLiveAircraftInViewport(
  viewport: BoundingBox,
  limit = 5000,
): Promise<Aircraft[]> {
  const params = new URLSearchParams({
    north: String(viewport.north),
    south: String(viewport.south),
    east: String(viewport.east),
    west: String(viewport.west),
    limit: String(limit),
  });

  const data = await httpRequest<LiveAircraftDto[]>({
    path: `/api/v1/aircraft/live?${params.toString()}`,
    method: "GET",
  });

  return data.map((flight) => ({
    icao: flight.icao,
    lat: flight.lat,
    lon: flight.lon,
    altitude: flight.altitude,
    speed: flight.speed,
    heading: flight.heading,
    eventTime: flight.eventTime,
    sourceId: flight.sourceId,
    registration: flight.registration,
    aircraftType: flight.aircraftType,
    operator: flight.operator,
    countryCode: null,
    countryFlagUrl: null,
    lastSeen: Date.now(),
    isMilitary: flight.isMilitary ?? false,
  }));
}
