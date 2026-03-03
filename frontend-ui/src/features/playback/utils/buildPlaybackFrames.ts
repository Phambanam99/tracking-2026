import { loadAircraftDbEntry } from "../../aircraft/db/aircraftDb";
import { resolveAircraftEnrichment } from "../../aircraft/types/aircraftTypes";
import type { Aircraft } from "../../aircraft/types/aircraftTypes";
import type { SearchResult } from "../../search/types/searchTypes";
import type { PlaybackFrame } from "../types/playbackTypes";

const MIN_BUCKET_MS = 5_000;
const MEDIUM_BUCKET_MS = 15_000;
const MAX_BUCKET_MS = 60_000;

function resolveBucketSizeMs(durationMs: number): number {
  if (durationMs <= 30 * 60_000) {
    return MIN_BUCKET_MS;
  }
  if (durationMs <= 6 * 60 * 60_000) {
    return MEDIUM_BUCKET_MS;
  }
  return MAX_BUCKET_MS;
}

function bucketTimestamp(timestamp: number, bucketSizeMs: number): number {
  return Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
}

async function loadPlaybackEnrichment(
  events: SearchResult[],
): Promise<Map<string, ReturnType<typeof resolveAircraftEnrichment>>> {
  const uniqueIcaos = [...new Set(events.map((event) => event.icao.toUpperCase()))];
  const enrichmentEntries = await Promise.all(
    uniqueIcaos.map(async (icao) => {
      const dbEntry = await loadAircraftDbEntry(icao);
      return [
        icao,
        resolveAircraftEnrichment({
          icao,
          registration: dbEntry?.registration,
          aircraftType: dbEntry?.aircraftType,
          operator: dbEntry?.operator,
          countryCode: dbEntry?.countryCode,
          countryFlagUrl: dbEntry?.countryFlagUrl,
        }),
      ] as const;
    }),
  );

  return new Map(enrichmentEntries);
}

function toPlaybackAircraft(
  position: SearchResult,
  enrichmentByIcao: Map<string, ReturnType<typeof resolveAircraftEnrichment>>,
): Aircraft {
  const enrichment = enrichmentByIcao.get(position.icao.toUpperCase())
    ?? resolveAircraftEnrichment({ icao: position.icao });

  return {
    icao: position.icao,
    callsign: position.callsign ?? null,
    registration: position.registration ?? enrichment.registration ?? null,
    aircraftType: position.aircraftType ?? enrichment.aircraftType ?? null,
    operator: position.operator ?? enrichment.operator ?? null,
    countryCode: enrichment.countryCode,
    countryFlagUrl: enrichment.countryFlagUrl,
    lat: position.lat,
    lon: position.lon,
    altitude: position.altitude ?? null,
    speed: position.speed ?? null,
    heading: position.heading ?? null,
    sourceId: position.sourceId ?? null,
    eventTime: position.eventTime,
    lastSeen: position.eventTime,
    isMilitary: enrichment.isMilitary,
  };
}

export async function buildPlaybackFrames(
  events: SearchResult[],
  timeFrom: string,
  timeTo: string,
): Promise<PlaybackFrame[]> {
  if (events.length === 0) {
    return [];
  }

  const enrichmentByIcao = await loadPlaybackEnrichment(events);
  const fromMs = new Date(timeFrom).getTime();
  const toMs = new Date(timeTo).getTime();
  const bucketSizeMs = resolveBucketSizeMs(Math.max(toMs - fromMs, MIN_BUCKET_MS));
  const maxStalenessMs = Math.max(bucketSizeMs * 3, 60_000);
  const sorted = [...events].sort((left, right) => left.eventTime - right.eventTime);
  const buckets = new Set<number>();

  for (const event of sorted) {
    buckets.add(bucketTimestamp(event.eventTime, bucketSizeMs));
  }

  const bucketList = [...buckets].sort((left, right) => left - right);
  const active = new Map<string, Aircraft>();
  const frames: PlaybackFrame[] = [];
  let eventIndex = 0;

  for (const timestamp of bucketList) {
    while (eventIndex < sorted.length && sorted[eventIndex].eventTime <= timestamp + bucketSizeMs - 1) {
      const next = toPlaybackAircraft(sorted[eventIndex], enrichmentByIcao);
      active.set(next.icao, next);
      eventIndex += 1;
    }

    const aircraft = [...active.values()]
      .filter((entry) => timestamp - entry.lastSeen <= maxStalenessMs)
      .sort((left, right) => left.icao.localeCompare(right.icao));

    if (aircraft.length === 0) {
      continue;
    }

    frames.push({
      timestamp,
      aircraft,
    });
  }

  return frames;
}
