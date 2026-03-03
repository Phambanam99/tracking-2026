/**
 * searchApi.ts — HTTP client wrappers for global & history search modes.
 *
 * Viewport mode uses in-memory filtering (see useSearchAircraft.ts).
 * Global and history modes call service-query (SRCH-03 through SRCH-06).
 */
import { httpRequest } from "../../../shared/api/httpClient";
import type { SearchFilters, SearchResponse, SearchResult } from "../types/searchTypes";

type AdvancedSearchBackendRequest = {
  icao?: string;
  callsign?: string;
  aircraftType?: string;
  timeFrom?: number;
  timeTo?: number;
  altitudeMin?: number;
  altitudeMax?: number;
  speedMin?: number;
  speedMax?: number;
  boundingBox?: SearchFilters["boundingBox"];
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

function toAdvancedSearchBackendRequest(
  filters: Omit<SearchFilters, "mode">,
): AdvancedSearchBackendRequest {
  return {
    icao: filters.icao || undefined,
    callsign: filters.callsign || undefined,
    aircraftType: filters.aircraftType || undefined,
    timeFrom: toEpochMillis(filters.timeFrom),
    timeTo: toEpochMillis(filters.timeTo),
    altitudeMin: filters.altitudeMin,
    altitudeMax: filters.altitudeMax,
    speedMin: filters.speedMin,
    speedMax: filters.speedMax,
    boundingBox: filters.boundingBox,
    sourceId: filters.sourceId || undefined,
  };
}

/**
 * Live global search via service-query Redis cache.
 *
 * Backend returns `SearchResult[]`; wrap into `SearchResponse` for the store.
 */
export async function searchGlobal(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: "100" });
  const results = await httpRequest<SearchResult[]>({
    path: `/api/v1/aircraft/search?${params.toString()}`,
    method: "GET",
  });
  return { results, total: results.length, truncated: results.length >= 100 };
}

/**
 * Advanced history search against TimescaleDB via service-query.
 *
 * Backend returns `SearchResult[]`; wrap into `SearchResponse` for the store.
 */
export async function searchHistory(filters: Omit<SearchFilters, "mode">): Promise<SearchResponse> {
  const results = await httpRequest<SearchResult[]>({
    path: "/api/v1/aircraft/search/history",
    method: "POST",
    body: toAdvancedSearchBackendRequest(filters),
  });
  return { results, total: results.length, truncated: results.length >= 5000 };
}

/**
 * Get position trail for one aircraft within a time range.
 */
export async function getFlightHistory(
  icao: string,
  from: number,
  to: number,
): Promise<SearchResult[]> {
  return httpRequest<SearchResult[]>({
    path: `/api/v1/aircraft/${icao}/history?from=${from}&to=${to}`,
    method: "GET",
  });
}
