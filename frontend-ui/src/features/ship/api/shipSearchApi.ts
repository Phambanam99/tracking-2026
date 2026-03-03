import { httpRequest } from "../../../shared/api/httpClient";

export type ShipSearchMode = "viewport" | "global" | "history";

export type ShipSearchBoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ShipSearchFilters = {
  query: string;
  mode: ShipSearchMode;
  mmsi?: string;
  imo?: string;
  callSign?: string;
  vesselName?: string;
  vesselType?: string;
  destination?: string;
  timeFrom?: string;
  timeTo?: string;
  speedMin?: number;
  speedMax?: number;
  boundingBox?: ShipSearchBoundingBox;
  sourceId?: string;
};

export type ShipSearchResult = {
  mmsi: string;
  lat: number;
  lon: number;
  speed?: number | null;
  course?: number | null;
  heading?: number | null;
  eventTime: number;
  sourceId?: string;
  vesselName?: string | null;
  vesselType?: string | null;
  imo?: string | null;
  callSign?: string | null;
  destination?: string | null;
  navStatus?: string | null;
  isMilitary?: boolean;
};

export type ShipSearchResponse = {
  results: ShipSearchResult[];
  total: number;
  truncated: boolean;
};

export type ShipHistoryPoint = {
  mmsi: string;
  lat: number;
  lon: number;
  speed?: number | null;
  course?: number | null;
  heading?: number | null;
  navStatus?: string | null;
  eventTime: number;
  sourceId: string;
};

type ShipAdvancedSearchBackendRequest = {
  mmsi?: string;
  imo?: string;
  callSign?: string;
  vesselName?: string;
  vesselType?: string;
  destination?: string;
  timeFrom?: number;
  timeTo?: number;
  speedMin?: number;
  speedMax?: number;
  boundingBox?: ShipSearchBoundingBox;
  sourceId?: string;
};

function toEpochMillis(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const [datePart = "", timePart = ""] = value.split("T");
  const [year = "0", month = "1", day = "1"] = datePart.split("-");
  const [hour = "0", minute = "0"] = timePart.split(":");
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function toShipAdvancedSearchBackendRequest(
  filters: Omit<ShipSearchFilters, "mode">,
): ShipAdvancedSearchBackendRequest {
  return {
    mmsi: filters.mmsi || undefined,
    imo: filters.imo || undefined,
    callSign: filters.callSign || undefined,
    vesselName: filters.vesselName || undefined,
    vesselType: filters.vesselType || undefined,
    destination: filters.destination || undefined,
    timeFrom: toEpochMillis(filters.timeFrom),
    timeTo: toEpochMillis(filters.timeTo),
    speedMin: filters.speedMin,
    speedMax: filters.speedMax,
    boundingBox: filters.boundingBox,
    sourceId: filters.sourceId || undefined,
  };
}

export async function searchShipGlobal(query: string): Promise<ShipSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: "100" });
  const results = await httpRequest<ShipSearchResult[]>({
    path: `/api/v1/ships/search?${params.toString()}`,
    method: "GET",
  });
  return { results, total: results.length, truncated: results.length >= 100 };
}

export async function searchShipHistory(filters: Omit<ShipSearchFilters, "mode">): Promise<ShipSearchResponse> {
  const results = await httpRequest<ShipSearchResult[]>({
    path: "/api/v1/ships/search/history",
    method: "POST",
    body: toShipAdvancedSearchBackendRequest(filters),
  });
  return { results, total: results.length, truncated: results.length >= 5000 };
}

export async function getShipHistory(
  mmsi: string,
  options: { from: number; to: number; limit?: number },
): Promise<ShipHistoryPoint[]> {
  const params = new URLSearchParams({
    from: String(options.from),
    to: String(options.to),
    limit: String(options.limit ?? 200),
  });

  return httpRequest<ShipHistoryPoint[]>({
    path: `/api/v1/ships/${encodeURIComponent(mmsi)}/history?${params.toString()}`,
    method: "GET",
  });
}
