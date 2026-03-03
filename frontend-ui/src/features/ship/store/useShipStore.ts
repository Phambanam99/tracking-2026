import { create } from "zustand";
import type { Ship } from "../types/shipTypes";

export type ShipSelectionMode = "viewport" | "global" | "history" | null;
export type ShipHistoryTrailStatus = "idle" | "loading" | "ready" | "error";
export type ShipHistoryTrailWindow = 1_800_000 | 7_200_000 | 21_600_000;

export const DEFAULT_SHIP_TRAIL_WINDOW_MS: ShipHistoryTrailWindow = 21_600_000;

export type ShipHistoryTrailPoint = {
  lat: number;
  lon: number;
  eventTime: number;
  speed: number | null;
  course: number | null;
  heading: number | null;
  sourceId: string;
};

export type ShipState = {
  ships: Record<string, Ship>;
  selectedMmsi: string | null;
  detailMmsi: string | null;
  selectedMode: ShipSelectionMode;
  detailMode: ShipSelectionMode;
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
  pruneStale: (maxAgeMs: number) => void;
  clearShips: () => void;
  selectShip: (mmsi: string | null, mode?: ShipSelectionMode) => void;
  showDetails: (mmsi: string, mode?: ShipSelectionMode) => void;
  hideDetails: () => void;
  setTrailLoading: (mmsi: string, anchorTime: number, rangeFrom: number, rangeTo: number) => void;
  setTrailReady: (mmsi: string, anchorTime: number, points: ShipHistoryTrailPoint[], rangeFrom: number, rangeTo: number) => void;
  setTrailError: (mmsi: string, anchorTime: number, message: string, rangeFrom: number, rangeTo: number) => void;
  clearTrail: () => void;
  setTrailWindow: (windowMs: ShipHistoryTrailWindow) => void;
};

export type ShipStore = ShipState & ShipActions;

export const useShipStore = create<ShipStore>((set) => ({
  ships: {},
  selectedMmsi: null,
  detailMmsi: null,
  selectedMode: null,
  detailMode: null,
  trailMmsi: null,
  trailAnchorTime: null,
  trailPoints: [],
  trailRangeFrom: null,
  trailRangeTo: null,
  trailStatus: "idle",
  trailError: null,
  trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,

  upsertShip: (ship) =>
    set((state) => {
      const current = state.ships[ship.mmsi];
      if (current && ship.eventTime < current.eventTime) {
        return state;
      }

      return {
        ships: {
          ...state.ships,
          [ship.mmsi]: {
            ...current,
            ...ship,
          },
        },
      };
    }),

  pruneStale: (maxAgeMs) =>
    set((state) => {
      const cutoff = Date.now() - maxAgeMs;
      const ships: Record<string, Ship> = {};
      for (const [mmsi, ship] of Object.entries(state.ships)) {
        if (ship.lastSeen >= cutoff) {
          ships[mmsi] = ship;
        }
      }

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
        trailMmsi:
          state.trailMmsi && !(state.trailMmsi in ships) ? null : state.trailMmsi,
        trailAnchorTime:
          state.trailMmsi && !(state.trailMmsi in ships) ? null : state.trailAnchorTime,
        trailPoints:
          state.trailMmsi && !(state.trailMmsi in ships) ? [] : state.trailPoints,
        trailRangeFrom:
          state.trailMmsi && !(state.trailMmsi in ships) ? null : state.trailRangeFrom,
        trailRangeTo:
          state.trailMmsi && !(state.trailMmsi in ships) ? null : state.trailRangeTo,
        trailStatus:
          state.trailMmsi && !(state.trailMmsi in ships) ? "idle" : state.trailStatus,
        trailError:
          state.trailMmsi && !(state.trailMmsi in ships) ? null : state.trailError,
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
      trailMmsi: null,
      trailAnchorTime: null,
      trailPoints: [],
      trailRangeFrom: null,
      trailRangeTo: null,
      trailStatus: "idle",
      trailError: null,
      trailWindowMs: DEFAULT_SHIP_TRAIL_WINDOW_MS,
    }),
  selectShip: (mmsi, mode = null) => set({ selectedMmsi: mmsi, selectedMode: mmsi ? mode : null }),
  showDetails: (mmsi, mode = null) => set({ detailMmsi: mmsi, detailMode: mode }),
  hideDetails: () => set({ detailMmsi: null, detailMode: null }),
  setTrailLoading: (mmsi, anchorTime, rangeFrom, rangeTo) =>
    set({
      trailMmsi: mmsi,
      trailAnchorTime: anchorTime,
      trailPoints: [],
      trailRangeFrom: rangeFrom,
      trailRangeTo: rangeTo,
      trailStatus: "loading",
      trailError: null,
    }),
  setTrailReady: (mmsi, anchorTime, points, rangeFrom, rangeTo) =>
    set({
      trailMmsi: mmsi,
      trailAnchorTime: anchorTime,
      trailPoints: points,
      trailRangeFrom: rangeFrom,
      trailRangeTo: rangeTo,
      trailStatus: "ready",
      trailError: null,
    }),
  setTrailError: (mmsi, anchorTime, message, rangeFrom, rangeTo) =>
    set({
      trailMmsi: mmsi,
      trailAnchorTime: anchorTime,
      trailPoints: [],
      trailRangeFrom: rangeFrom,
      trailRangeTo: rangeTo,
      trailStatus: "error",
      trailError: message,
    }),
  clearTrail: () =>
    set({
      trailMmsi: null,
      trailAnchorTime: null,
      trailPoints: [],
      trailRangeFrom: null,
      trailRangeTo: null,
      trailStatus: "idle",
      trailError: null,
    }),
  setTrailWindow: (windowMs) => set({ trailWindowMs: windowMs }),
}));
