/**
 * searchApi.ts — HTTP client wrappers for global & history search modes.
 *
 * Viewport mode uses in-memory filtering (see useSearchAircraft.ts).
 * Global and history modes call service-query (SRCH-03 through SRCH-06).
 */
import { httpRequest } from "../../../shared/api/httpClient";
import type { SearchFilters, SearchResponse, SearchResult } from "../types/searchTypes";

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
    body: filters,
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
