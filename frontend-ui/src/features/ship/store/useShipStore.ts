import { create } from "zustand";
import type { Ship } from "../types/shipTypes";

export type ShipSelectionMode = "viewport" | "global" | "history" | null;
export type ShipHistoryTrailStatus = "idle" | "loading" | "ready" | "error";
export type ShipHistoryTrailWindow = 1_800_000 | 7_200_000 | 21_600_000;

export const DEFAULT_SHIP_TRAIL_WINDOW_MS: ShipHistoryTrailWindow = 21_600_000;

const SHIP_TRAIL_ROUTE_COLORS = [
  "#818cf8",
  "#22d3ee",
  "#f59e0b",
  "#34d399",
  "#f472b6",
  "#fb7185",
];

export type ShipHistoryTrailPoint = {
  lat: number;
  lon: number;
  eventTime: number;
  speed: number | null;
  course: number | null;
  heading: number | null;
  sourceId: string;
};

export type ShipTrailRoute = {
  key: string;
  mmsi: string;
  anchorTime: number;
  points: ShipHistoryTrailPoint[];
  rangeFrom: number;
  rangeTo: number;
  status: ShipHistoryTrailStatus;
  error: string | null;
  color: string;
};

export type ShipState = {
  ships: Record<string, Ship>;
  selectedMmsi: string | null;
  detailMmsi: string | null;
  selectedMode: ShipSelectionMode;
  detailMode: ShipSelectionMode;
  activeTrailRouteKey: string | null;
  trailRoutes: Record<string, ShipTrailRoute>;
  trailRouteOrder: string[];
  trailMmsi: string | null;
  trailAnchorTime: number | null;
  trailPoints: ShipHistoryTrailPoint[];
  trailRangeFrom: number | null;
  trailRangeTo: number | null;
  trailStatus: ShipHistoryTrailStatus;
  trailError: string | null;
  trailWindowMs: ShipHistoryTrailWindow;
};

export type ShipActions = {
  upsertShip: (ship: Ship) => void;
  upsertShipBatch: (ships: Ship[]) => void;
  pruneStale: (maxAgeMs: number, preserveMmsis?: ReadonlySet<string>) => void;
  clearShips: () => void;
  selectShip: (mmsi: string | null, mode?: ShipSelectionMode) => void;
  showDetails: (mmsi: string, mode?: ShipSelectionMode) => void;
  hideDetails: () => void;
  setTrailLoading: (routeKey: string, mmsi: string, anchorTime: number, rangeFrom: number, rangeTo: number) => void;
  setTrailReady: (routeKey: string, mmsi: string, anchorTime: number, points: ShipHistoryTrailPoint[], rangeFrom: number, rangeTo: number) => void;
  setTrailError: (routeKey: string, mmsi: string, anchorTime: number, message: string, rangeFrom: number, rangeTo: number) => void;
  clearTrail: (routeKey?: string | null) => void;
  clearAllTrails: () => void;
  setActiveTrailRoute: (routeKey: string | null) => void;
  setTrailWindow: (windowMs: ShipHistoryTrailWindow) => void;
};

export type ShipStore = ShipState & ShipActions;

function mergeShipMap(currentShips: Record<string, Ship>, incomingShips: Ship[]): Record<string, Ship> {
  const mergedShips = { ...currentShips };

  for (const ship of incomingShips) {
    const current = mergedShips[ship.mmsi];
    if (current && ship.eventTime < current.eventTime) {
      continue;
    }

    mergedShips[ship.mmsi] = {
      ...current,
      ...ship,
    };
  }

  return mergedShips;
}

function pickTrailRouteColor(index: number): string {
  return SHIP_TRAIL_ROUTE_COLORS[index % SHIP_TRAIL_ROUTE_COLORS.length] ?? SHIP_TRAIL_ROUTE_COLORS[0];
}

function buildRouteKey(mmsi: string, anchorTime: number): string {
  return `${mmsi}:${anchorTime}`;
}

function createEmptyTrailState(): Pick<
  ShipState,
  "activeTrailRouteKey" | "trailMmsi" | "trailAnchorTime" | "trailPoints" | "trailRangeFrom" | "trailRangeTo" | "trailStatus" | "trailError"
> {
  return {
    activeTrailRouteKey: null,
    trailMmsi: null,
    trailAnchorTime: null,
    trailPoints: [],
    trailRangeFrom: null,
    trailRangeTo: null,
    trailStatus: "idle",
    trailError: null,
  };
}

function getFallbackTrailKey(trailRouteOrder: string[]): string | null {
  return trailRouteOrder[trailRouteOrder.length - 1] ?? null;
}

function buildActiveTrailState(
  trailRoutes: Record<string, ShipTrailRoute>,
  activeTrailRouteKey: string | null,
): Pick<
  ShipState,
  "activeTrailRouteKey" | "trailMmsi" | "trailAnchorTime" | "trailPoints" | "trailRangeFrom" | "trailRangeTo" | "trailStatus" | "trailError"
> {
  if (!activeTrailRouteKey) {
    return createEmptyTrailState();
  }

  const route = trailRoutes[activeTrailRouteKey];
  if (!route) {
    return createEmptyTrailState();
  }

  return {
    activeTrailRouteKey,
    trailMmsi: route.mmsi,
    trailAnchorTime: route.anchorTime,
    trailPoints: route.points,
    trailRangeFrom: route.rangeFrom,
    trailRangeTo: route.rangeTo,
    trailStatus: route.status,
    trailError: route.error,
  };
}

function withTrailRoute(
  state: ShipState,
  routeKey: string,
  nextRoute: Omit<ShipTrailRoute, "color">,
): Pick<
  ShipState,
  "trailRoutes" | "trailRouteOrder" | "activeTrailRouteKey" | "trailMmsi" | "trailAnchorTime" | "trailPoints" | "trailRangeFrom" | "trailRangeTo" | "trailStatus" | "trailError"
> {
  const existingRoute = state.trailRoutes[routeKey];
  const trailRoutes = {
    ...state.trailRoutes,
    [routeKey]: {
      ...nextRoute,
      color: existingRoute?.color ?? pickTrailRouteColor(Object.keys(state.trailRoutes).length),
    },
  };
  const trailRouteOrder = state.trailRouteOrder.includes(routeKey)
    ? state.trailRouteOrder
    : [...state.trailRouteOrder, routeKey];

  return {
    trailRoutes,
    trailRouteOrder,
    ...buildActiveTrailState(trailRoutes, routeKey),
  };
}

export const useShipStore = create<ShipStore>((set) => ({
  ships: {},
  selectedMmsi: null,
  detailMmsi: null,
  selectedMode: null,
  detailMode: null,
  activeTrailRouteKey: null,
  trailRoutes: {},
  trailRouteOrder: [],
  trailMmsi: null,
  trailAnchorTime: null,
  trailPoints: [],
  trailRangeFrom: null,
  trailRangeTo: null,
  trailStatus: "idle",
  trailError: null,
  trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,

  upsertShip: (ship) =>
    set((state) => ({
      ships: mergeShipMap(state.ships, [ship]),
    })),

  upsertShipBatch: (ships) =>
    set((state) => {
      if (ships.length === 0) {
        return state;
      }

      return {
        ships: mergeShipMap(state.ships, ships),
      };
    }),

  pruneStale: (maxAgeMs, preserveMmsis = new Set<string>()) =>
    set((state) => {
      const cutoff = Date.now() - maxAgeMs;
      const ships: Record<string, Ship> = {};
      for (const [mmsi, ship] of Object.entries(state.ships)) {
        if (ship.lastSeen >= cutoff || preserveMmsis.has(mmsi)) {
          ships[mmsi] = ship;
        }
      }

      const trailRoutes = Object.fromEntries(
        Object.entries(state.trailRoutes).filter(([, route]) => route.mmsi in ships),
      );
      const trailRouteOrder = state.trailRouteOrder.filter((routeKey) => routeKey in trailRoutes);
      const nextActiveTrailRouteKey =
        state.activeTrailRouteKey && state.activeTrailRouteKey in trailRoutes
          ? state.activeTrailRouteKey
          : getFallbackTrailKey(trailRouteOrder);

      return {
        ships,
        selectedMmsi:
          state.selectedMmsi && !(state.selectedMmsi in ships) ? null : state.selectedMmsi,
        detailMmsi:
          state.detailMmsi && !(state.detailMmsi in ships) ? null : state.detailMmsi,
        selectedMode:
          state.selectedMmsi && !(state.selectedMmsi in ships) ? null : state.selectedMode,
        detailMode:
          state.detailMmsi && !(state.detailMmsi in ships) ? null : state.detailMode,
        trailRoutes,
        trailRouteOrder,
        ...buildActiveTrailState(trailRoutes, nextActiveTrailRouteKey),
        trailWindowMs: state.trailWindowMs,
      };
    }),

  clearShips: () =>
    set({
      ships: {},
      selectedMmsi: null,
      detailMmsi: null,
      selectedMode: null,
      detailMode: null,
      trailRoutes: {},
      trailRouteOrder: [],
      ...createEmptyTrailState(),
      trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
    }),

  selectShip: (mmsi, mode = null) => set({ selectedMmsi: mmsi, selectedMode: mmsi ? mode : null }),
  showDetails: (mmsi, mode = null) => set({ detailMmsi: mmsi, detailMode: mode }),
  hideDetails: () => set({ detailMmsi: null, detailMode: null }),

  setTrailLoading: (routeKey, mmsi, anchorTime, rangeFrom, rangeTo) =>
    set((state) =>
      withTrailRoute(state, routeKey, {
        key: routeKey,
        mmsi,
        anchorTime,
        points: [],
        rangeFrom,
        rangeTo,
        status: "loading",
        error: null,
      }),
    ),

  setTrailReady: (routeKey, mmsi, anchorTime, points, rangeFrom, rangeTo) =>
    set((state) =>
      withTrailRoute(state, routeKey, {
        key: routeKey,
        mmsi,
        anchorTime,
        points,
        rangeFrom,
        rangeTo,
        status: "ready",
        error: null,
      }),
    ),

  setTrailError: (routeKey, mmsi, anchorTime, message, rangeFrom, rangeTo) =>
    set((state) =>
      withTrailRoute(state, routeKey, {
        key: routeKey,
        mmsi,
        anchorTime,
        points: [],
        rangeFrom,
        rangeTo,
        status: "error",
        error: message,
      }),
    ),

  clearTrail: (routeKey = null) =>
    set((state) => {
      const targetKey = routeKey ?? state.activeTrailRouteKey;
      if (!targetKey) {
        return state;
      }

      const trailRoutes = { ...state.trailRoutes };
      delete trailRoutes[targetKey];
      const trailRouteOrder = state.trailRouteOrder.filter((currentKey) => currentKey !== targetKey);
      const nextActiveTrailRouteKey =
        state.activeTrailRouteKey === targetKey
          ? getFallbackTrailKey(trailRouteOrder)
          : state.activeTrailRouteKey;

      return {
        trailRoutes,
        trailRouteOrder,
        ...buildActiveTrailState(trailRoutes, nextActiveTrailRouteKey),
      };
    }),

  clearAllTrails: () =>
    set({
      trailRoutes: {},
      trailRouteOrder: [],
      ...createEmptyTrailState(),
    }),

  setActiveTrailRoute: (routeKey) =>
    set((state) => ({
      ...buildActiveTrailState(state.trailRoutes, routeKey && state.trailRoutes[routeKey] ? routeKey : null),
    })),

  setTrailWindow: (windowMs) => set({ trailWindowMs: windowMs }),
}));

export function toShipTrailRouteKey(mmsi: string, anchorTime: number): string {
  return buildRouteKey(mmsi, anchorTime);
}
