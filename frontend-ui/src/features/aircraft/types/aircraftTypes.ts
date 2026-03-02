/**
 * Represents a tracked aircraft with enriched metadata from the backend.
 */
export type Aircraft = {
  icao: string;
  callsign?: string | null;
  lat: number;
  lon: number;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  /** ICAO registration e.g. "VN-A321" */
  registration?: string | null;
  /** ICAO type designator e.g. "A321" */
  aircraftType?: string | null;
  /** Airline or operator name */
  operator?: string | null;
  /** ISO 3166-1 alpha-2 country code e.g. "VN" */
  countryCode?: string | null;
  /** URL for the country flag image */
  countryFlagUrl?: string | null;
  /** Source identifier e.g. "RADARBOX-GLOBAL" */
  sourceId?: string | null;
  /** Unix timestamp (ms) of the original ADS-B event */
  eventTime?: number | null;
  /** Unix timestamp (ms) of last received position */
  lastSeen: number;
  /** Whether this aircraft belongs to a known military ICAO hex address */
  isMilitary: boolean;
};

/**
 * Wire format of the AircraftMetadata nested object from backend (snake_case).
 */
export type WireAircraftMetadata = {
  registration?: string | null;
  aircraft_type?: string | null;
  operator?: string | null;
  country_code?: string | null;
  country_flag_url?: string | null;
  image_url?: string | null;
  is_military?: boolean;
};

/**
 * Wire format of the enriched flight sent by the backend (snake_case).
 * Matches the Java `EnrichedFlight` with `AircraftMetadata` nested inside.
 */
export type AircraftFlight = {
  icao: string;
  lat: number;
  lon: number;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  callsign?: string | null;
  event_time: number;
  source_id: string;
  is_historical?: boolean;
  metadata?: WireAircraftMetadata | null;
};

/** Converts an AircraftFlight (WebSocket payload, snake_case) to an Aircraft store entry. */
export function toAircraft(flight: AircraftFlight): Aircraft {
  const meta = flight.metadata;
  const countryCode = meta?.country_code ?? null;
  return {
    icao: flight.icao,
    callsign: flight.callsign ?? null,
    lat: flight.lat,
    lon: flight.lon,
    heading: flight.heading ?? null,
    speed: flight.speed ?? null,
    altitude: flight.altitude ?? null,
    registration: meta?.registration ?? null,
    aircraftType: meta?.aircraft_type ?? null,
    operator: meta?.operator ?? null,
    countryCode,
    countryFlagUrl: meta?.country_flag_url
      ?? (countryCode ? `https://flagcdn.com/h80/${countryCode.toLowerCase()}.png` : null),
    sourceId: flight.source_id,
    eventTime: flight.event_time,
    lastSeen: Date.now(),
    isMilitary: meta?.is_military ?? false,
  };
}
