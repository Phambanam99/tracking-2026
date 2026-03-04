import { HttpError, httpRequest } from "../../../shared/api/httpClient";
import type { BoundingBox } from "../../map/render/flightLayer";
import { toLiveShip, type Ship } from "../types/shipTypes";

const DEFAULT_HISTORY_LIMIT = 15_000;
const DEFAULT_VIEWPORT_HISTORY_LIMIT = 5_000;

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
  upstreamSource?: string | null;
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
  upstreamSource?: string | null;
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
  return { results, total: results.length, truncated: results.length >= DEFAULT_HISTORY_LIMIT };
}

export async function getShipHistory(
  mmsi: string,
  options: { from: number; to: number; limit?: number },
): Promise<ShipHistoryPoint[]> {
  const params = new URLSearchParams({
    from: String(options.from),
    to: String(options.to),
    limit: String(options.limit ?? DEFAULT_HISTORY_LIMIT),
  });

  return httpRequest<ShipHistoryPoint[]>({
    path: `/api/v1/ships/${encodeURIComponent(mmsi)}/history?${params.toString()}`,
    method: "GET",
  });
}

export async function getAllShipHistory(
  mmsi: string,
  options: { from: number; to: number; batchLimit?: number; maxBatches?: number },
): Promise<ShipHistoryPoint[]> {
  const batchLimit = Math.min(Math.max(options.batchLimit ?? DEFAULT_HISTORY_LIMIT, 1), DEFAULT_HISTORY_LIMIT);
  const maxBatches = Math.max(options.maxBatches ?? 100, 1);
  const batches: ShipHistoryPoint[] = [];
  let cursorTo = options.to;
  let batchCount = 0;

  while (cursorTo >= options.from && batchCount < maxBatches) {
    const batch = await getShipHistory(mmsi, {
      from: options.from,
      to: cursorTo,
      limit: batchLimit,
    });
    batchCount += 1;

    if (batch.length === 0) {
      break;
    }

    batches.push(...batch);
    const oldestPoint = batch[batch.length - 1];
    if (!oldestPoint || batch.length < batchLimit || oldestPoint.eventTime <= options.from) {
      break;
    }

    cursorTo = oldestPoint.eventTime - 1;
  }

  const uniquePoints = new Map<string, ShipHistoryPoint>();
  for (const point of batches) {
    uniquePoints.set(
      `${point.mmsi}:${point.eventTime}:${point.lat}:${point.lon}:${point.sourceId}`,
      point,
    );
  }

  return Array.from(uniquePoints.values()).sort((left, right) => left.eventTime - right.eventTime);
}

export async function fetchLiveShipsInViewport(
  viewport: BoundingBox,
  options: { lookbackMs?: number; limit?: number } = {},
): Promise<Ship[]> {
  const now = Date.now();
  const fallbackLimits: Array<number | null> = [
    options.limit ?? DEFAULT_VIEWPORT_HISTORY_LIMIT,
    2_000,
    1_000,
    500,
    null,
  ];
  const dedupedLimits = Array.from(new Set(fallbackLimits));

  let results: ShipSearchResult[] | null = null;
  let lastError: unknown = null;
  for (const fallbackLimit of dedupedLimits) {
    try {
      const body: Record<string, unknown> = {
        boundingBox: {
          north: viewport.north,
          south: viewport.south,
          east: viewport.east,
          west: viewport.west,
        },
        timeFrom: now - (options.lookbackMs ?? 2 * 60 * 60 * 1000),
        timeTo: now,
      };
      if (fallbackLimit != null) {
        body.limit = fallbackLimit;
      }

      results = await httpRequest<ShipSearchResult[]>({
        path: "/api/v1/ships/search/history",
        method: "POST",
        body,
      });
      break;
    } catch (error: unknown) {
      lastError = error;
      if (!(error instanceof HttpError) || error.status !== 400) {
        throw error;
      }
    }
  }

  if (!results) {
    throw lastError instanceof Error ? lastError : new Error("ship-viewport-history-fallback-failed");
  }

  return results.map((result) => toLiveShip(result, now));
}
