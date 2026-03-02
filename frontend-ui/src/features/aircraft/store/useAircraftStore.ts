import { create } from "zustand";
import type { Aircraft } from "../types/aircraftTypes";
import type { TrailPosition } from "../types/trailTypes";

export type AircraftState = {
  /** All currently tracked aircraft, keyed by ICAO hex. */
  aircraft: Record<string, Aircraft>;
  /** ICAO of the selected aircraft, or null. */
  selectedIcao: string | null;
  /** ICAO of the aircraft whose detail panel is open. */
  detailIcao: string | null;
  /** ICAO of the aircraft whose trail is currently active. */
  trailIcao: string | null;
  /** Historical + live trail positions for the active aircraft. */
  trailPositions: TrailPosition[];
};

export type AircraftActions = {
  /** Insert or update a single aircraft entry. */
  upsertAircraft: (aircraft: Aircraft) => void;
  /** Insert or update multiple aircraft entries in one store write. */
  upsertAircraftBatch: (aircraft: Aircraft[]) => void;
  /** Set the selected aircraft ICAO. Pass null to deselect. */
  selectAircraft: (icao: string | null) => void;
  /** Open the detail panel for a specific aircraft. */
  showDetails: (icao: string) => void;
  /** Close the detail panel. */
  hideDetails: () => void;
  /** Activate trail mode for one aircraft and replace current positions. */
  setTrail: (icao: string, positions: TrailPosition[]) => void;
  /** Clear the active trail. */
  clearTrail: () => void;
  /** Remove aircraft whose lastSeen is older than maxAgeMs. */
  pruneStale: (maxAgeMs: number) => void;
};

export type AircraftStore = AircraftState & AircraftActions;

function toTrailPosition(aircraft: Aircraft): TrailPosition {
  return {
    lat: aircraft.lat,
    lon: aircraft.lon,
    altitude: aircraft.altitude ?? null,
    heading: aircraft.heading ?? null,
    eventTime: aircraft.lastSeen,
  };
}

function mergeAircraftBatch(
  state: AircraftState,
  aircraftBatch: Aircraft[],
): Pick<AircraftState, "aircraft" | "trailPositions"> {
  const nextAircraft = { ...state.aircraft };
  let nextTrailPositions = state.trailPositions;

  for (const aircraft of aircraftBatch) {
    const current = nextAircraft[aircraft.icao];
    if (
      current?.eventTime != null &&
      aircraft.eventTime != null &&
      aircraft.eventTime < current.eventTime
    ) {
      continue;
    }

    nextAircraft[aircraft.icao] = {
      ...current,
      ...aircraft,
    };
    if (aircraft.icao === state.trailIcao) {
      nextTrailPositions = [...nextTrailPositions, toTrailPosition(aircraft)];
    }
  }

  return {
    aircraft: nextAircraft,
    trailPositions: nextTrailPositions,
  };
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: {},
  selectedIcao: null,
  detailIcao: null,
  trailIcao: null,
  trailPositions: [],

  upsertAircraft: (aircraft) =>
    set((state) => mergeAircraftBatch(state, [aircraft])),

  upsertAircraftBatch: (aircraftBatch) =>
    set((state) => mergeAircraftBatch(state, aircraftBatch)),

  selectAircraft: (icao) =>
    set((state) =>
      icao === null
        ? {
            selectedIcao: null,
            trailIcao: null,
            trailPositions: [],
          }
        : {
            selectedIcao: icao,
            trailIcao: state.trailIcao !== icao ? null : state.trailIcao,
            trailPositions: state.trailIcao !== icao ? [] : state.trailPositions,
          },
    ),

  showDetails: (icao) =>
    set({ detailIcao: icao }),

  hideDetails: () =>
    set({ detailIcao: null }),

  setTrail: (icao, positions) =>
    set({
      trailIcao: icao,
      trailPositions: positions,
    }),

  clearTrail: () =>
    set({
      trailIcao: null,
      trailPositions: [],
    }),

  pruneStale: (maxAgeMs) =>
    set((state) => {
      const cutoff = Date.now() - maxAgeMs;
      const next: Record<string, Aircraft> = {};
      for (const [icao, ac] of Object.entries(state.aircraft)) {
        if (ac.lastSeen >= cutoff) {
          next[icao] = ac;
        }
      }
      // If the selected aircraft was pruned, deselect it.
      const selectedIcao =
        state.selectedIcao !== null && !(state.selectedIcao in next)
          ? null
          : state.selectedIcao;
      const shouldClearTrail =
        state.trailIcao !== null && !(state.trailIcao in next);
      return {
        aircraft: next,
        selectedIcao,
        trailIcao: shouldClearTrail ? null : state.trailIcao,
        trailPositions: shouldClearTrail ? [] : state.trailPositions,
      };
    }),
}));
