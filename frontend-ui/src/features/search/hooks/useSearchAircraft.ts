import { useEffect, useRef } from "react";
import { useAircraftStore } from "../../aircraft/store/useAircraftStore";
import { useSearchStore } from "../store/useSearchStore";
import { searchGlobal } from "../api/searchApi";
import type { Aircraft } from "../../aircraft/types/aircraftTypes";
import type { SearchResult } from "../types/searchTypes";

/**
 * Filter aircraft currently in the store against a text query.
 * Pure in-memory — no API calls. Used in "viewport" search mode.
 */
export function filterAircraftInViewport(
  aircraft: Record<string, Aircraft>,
  query: string,
): SearchResult[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return Object.values(aircraft)
    .filter(
      (a) =>
        a.icao.toLowerCase().includes(q) ||
        a.callsign?.toLowerCase().includes(q) ||
        a.registration?.toLowerCase().includes(q) ||
        a.operator?.toLowerCase().includes(q) ||
        a.aircraftType?.toLowerCase().includes(q),
    )
    .slice(0, 50)
    .map((a) => ({
      icao: a.icao,
      callsign: a.callsign ?? undefined,
      registration: a.registration ?? undefined,
      aircraftType: a.aircraftType ?? undefined,
      lat: a.lat,
      lon: a.lon,
      altitude: a.altitude,
      speed: a.speed,
      heading: a.heading,
      eventTime: a.eventTime ?? 0,
      sourceId: a.sourceId ?? undefined,
      operator: a.operator ?? undefined,
    }));
}

/**
 * Hook that drives search for viewport and global modes:
 * - **viewport**: 200 ms debounce, in-memory filter (no API)
 * - **global**: 500 ms debounce, calls `GET /api/v1/aircraft/search`
 * - **history**: driven by AdvancedSearchForm submit button — this hook is a no-op
 */
export function useSearchAircraft(): void {
  const aircraft = useAircraftStore((s) => s.aircraft);
  const query = useSearchStore((s) => s.filters.query);
  const mode = useSearchStore((s) => s.filters.mode);
  const setResults = useSearchStore((s) => s.setResults);
  const setSearching = useSearchStore((s) => s.setSearching);
  const setError = useSearchStore((s) => s.setError);
  const abortRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous debounce
    if (abortRef.current !== null) {
      clearTimeout(abortRef.current);
      abortRef.current = null;
    }

    if (mode === "history") return;

    const debounceMs = mode === "global" ? 500 : 200;

    abortRef.current = setTimeout(() => {
      if (mode === "viewport") {
        const results = filterAircraftInViewport(aircraft, query);
        setResults(results);
      } else if (mode === "global") {
        if (query.length < 2) {
          setResults([]);
          return;
        }
        setSearching(true);
        setError(null);
        searchGlobal(query)
          .then((resp) => {
            setResults(resp.results);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Search failed");
          })
          .finally(() => {
            setSearching(false);
          });
      }
    }, debounceMs);

    return () => {
      if (abortRef.current !== null) {
        clearTimeout(abortRef.current);
      }
    };
  }, [aircraft, query, mode, setResults, setSearching, setError]);
}

