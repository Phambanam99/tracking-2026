export type ShipMetadata = {
  flagCountry?: string | null;
  flagUrl?: string | null;
  shipTypeName?: string | null;
  isMilitary?: boolean | null;
};

export type SocketShip = {
  mmsi: string;
  lat: number;
  lon: number;
  speed?: number | null;
  course?: number | null;
  heading?: number | null;
  nav_status?: string | null;
  vessel_name?: string | null;
  vessel_type?: string | null;
  imo?: string | null;
  call_sign?: string | null;
  destination?: string | null;
  eta?: number | null;
  event_time: number;
  source_id: string;
  is_historical?: boolean;
  metadata?: {
    flag_country?: string | null;
    flag_url?: string | null;
    ship_type_name?: string | null;
    is_military?: boolean | null;
  } | null;
};

export type Ship = {
  mmsi: string;
  lat: number;
  lon: number;
  speed: number | null;
  course: number | null;
  heading: number | null;
  navStatus: string | null;
  vesselName: string | null;
  vesselType: string | null;
  imo: string | null;
  callSign: string | null;
  destination: string | null;
  eta: number | null;
  eventTime: number;
  sourceId: string;
  isHistorical: boolean;
  metadata: ShipMetadata | null;
  lastSeen: number;
};

export function toShip(ship: SocketShip, receivedAt = Date.now()): Ship {
  return {
    mmsi: ship.mmsi,
    lat: ship.lat,
    lon: ship.lon,
    speed: ship.speed ?? null,
    course: ship.course ?? null,
    heading: ship.heading ?? null,
    navStatus: ship.nav_status ?? null,
    vesselName: ship.vessel_name ?? null,
    vesselType: ship.vessel_type ?? null,
    imo: ship.imo ?? null,
    callSign: ship.call_sign ?? null,
    destination: ship.destination ?? null,
    eta: ship.eta ?? null,
    eventTime: ship.event_time,
    sourceId: ship.source_id,
    isHistorical: ship.is_historical ?? false,
    metadata: ship.metadata
      ? {
          flagCountry: ship.metadata.flag_country ?? null,
          flagUrl: ship.metadata.flag_url ?? null,
          shipTypeName: ship.metadata.ship_type_name ?? null,
          isMilitary: ship.metadata.is_military ?? null,
        }
      : null,
    lastSeen: receivedAt,
  };
}
