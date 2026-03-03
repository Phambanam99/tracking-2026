import { httpRequest } from "../../../shared/api/httpClient";
import { resolveAircraftEnrichment } from "../../aircraft/types/aircraftTypes";
import { searchHistory } from "../../search/api/searchApi";
import type { SearchResult } from "../../search/types/searchTypes";
import type { LonLatExtent } from "../../map/types/mapTypes";
import type { PlaybackFrame } from "../types/playbackTypes";

export type PlaybackFramesRequest = {
  timeFrom: number;
  timeTo: number;
  boundingBox: LonLatExtent;
  bucketSizeMs?: number;
  maxFrames?: number;
  cursor?: string | null;
};

type PlaybackFrameAircraftResponse = {
  icao: string;
  lat: number;
  lon: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  eventTime: number;
  sourceId?: string | null;
  registration?: string | null;
  aircraftType?: string | null;
  operator?: string | null;
};

type PlaybackFrameResponse = {
  timestamp: number;
  aircraft: PlaybackFrameAircraftResponse[];
};

export type PlaybackFramesResponse = {
  frames: PlaybackFrameResponse[];
  totalFrames: number;
  returnedFrames: number;
  hasMore: boolean;
  nextCursor: string | null;
  bucketSizeMs: number;
  metadata: {
    queryTimeMs: number;
    totalAircraftSeen: number;
  };
};

export async function fetchPlaybackFrames(
  request: PlaybackFramesRequest,
  signal?: AbortSignal,
): Promise<PlaybackFramesResponse> {
  return httpRequest<PlaybackFramesResponse>({
    method: "POST",
    path: "/api/v1/playback/frames",
    body: request,
    signal,
  });
}

export function toPlaybackFrames(response: PlaybackFramesResponse): PlaybackFrame[] {
  return response.frames.map((frame) => ({
    timestamp: frame.timestamp,
    aircraft: frame.aircraft.map((item) => {
      const enrichment = resolveAircraftEnrichment({
        icao: item.icao,
        registration: item.registration,
        aircraftType: item.aircraftType,
        operator: item.operator,
      });

      return {
        icao: item.icao,
        callsign: null,
        lat: item.lat,
        lon: item.lon,
        altitude: item.altitude ?? null,
        speed: item.speed ?? null,
        heading: item.heading ?? null,
        registration: enrichment.registration,
        aircraftType: enrichment.aircraftType,
        operator: enrichment.operator,
        countryCode: enrichment.countryCode,
        countryFlagUrl: enrichment.countryFlagUrl,
        sourceId: item.sourceId ?? null,
        eventTime: item.eventTime,
        lastSeen: item.eventTime,
        isMilitary: enrichment.isMilitary,
      };
    }),
  }));
}

export async function fetchViewportPlaybackEvents(input: {
  viewport: LonLatExtent;
  timeFrom: string;
  timeTo: string;
}): Promise<SearchResult[]> {
  const response = await searchHistory({
    timeFrom: input.timeFrom,
    timeTo: input.timeTo,
    boundingBox: {
      north: input.viewport.north,
      south: input.viewport.south,
      east: input.viewport.east,
      west: input.viewport.west,
    },
  });

  return response.results;
}
