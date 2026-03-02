export type SearchMode = "viewport" | "global" | "history";

export interface SearchFilters {
  query: string;
  mode: SearchMode;
  // Advanced filters (history mode only)
  icao?: string;
  callsign?: string;
  aircraftType?: string;
  timeFrom?: string;
  timeTo?: string;
  altitudeMin?: number;
  altitudeMax?: number;
  speedMin?: number;
  speedMax?: number;
  boundingBox?: SearchBoundingBox;
  sourceId?: string;
}

export interface SearchBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SearchResult {
  icao: string;
  callsign?: string;
  registration?: string;
  aircraftType?: string;
  lat: number;
  lon: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  eventTime: number;
  sourceId?: string;
  operator?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  truncated: boolean;
}
