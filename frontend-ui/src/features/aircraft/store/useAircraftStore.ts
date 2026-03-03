import { create } from "zustand";
import type { Aircraft } from "../types/aircraftTypes";
import type { TrailPosition, TrailRoute } from "../types/trailTypes";

const DEFAULT_TRAIL_PLAYBACK_SPEED_MS = 600;
const MIN_TRAIL_PLAYBACK_SPEED_MS = 200;
const MAX_TRAIL_PLAYBACK_SPEED_MS = 2400;
const TRAIL_ROUTE_COLORS = [
  "#22d3ee",
  "#f59e0b",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fb7185",
];

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
  /** Current playback index into the active trail positions. */
  trailPlaybackIndex: number;
  /** Whether trail playback animation is currently running. */
  isTrailPlaying: boolean;
  /** Delay between playback frames for the active trail route. */
  trailPlaybackSpeedMs: number;
  /** Loaded trail routes keyed by aircraft ICAO for route comparison. */
  trailRoutes: Record<string, TrailRoute>;
  /** Load order for trail routes to keep compare UI stable. */
  trailRouteOrder: string[];
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
  /** Load or replace a trail route and make it active. */
  setTrail: (icao: string, positions: TrailPosition[]) => void;
  /** Clear the current active trail route. */
  clearTrail: () => void;
  /** Move trail playback cursor to a specific point. */
  setTrailPlaybackIndex: (index: number) => void;
  /** Start trail playback animation. */
  playTrail: () => void;
  /** Pause trail playback animation. */
  pauseTrail: () => void;
  /** Toggle trail playback animation. */
  toggleTrailPlayback: () => void;
  /** Set the delay between playback frames. */
  setTrailPlaybackSpeedMs: (speedMs: number) => void;
  /** Focus one of the already loaded route trails. */
  setActiveTrail: (icao: string) => void;
  /** Remove aircraft whose lastSeen is older than maxAgeMs. */
  pruneStale: (maxAgeMs: number) => void;
  /** Keep only aircraft whose ICAO is in the given set; prune the rest. */
  retainOnly: (icaos: Set<string>) => void;
};

export type AircraftStore = AircraftState & AircraftActions;

function clampPlaybackSpeed(speedMs: number): number {
  return Math.max(
    MIN_TRAIL_PLAYBACK_SPEED_MS,
    Math.min(MAX_TRAIL_PLAYBACK_SPEED_MS, Math.round(speedMs)),
  );
}

function createEmptyTrailState(): Pick<
  AircraftState,
  "trailIcao" | "trailPositions" | "trailPlaybackIndex" | "isTrailPlaying"
> {
  return {
    trailIcao: null,
    trailPositions: [],
    trailPlaybackIndex: 0,
    isTrailPlaying: false,
  };
}

function pickTrailRouteColor(index: number): string {
  return TRAIL_ROUTE_COLORS[index % TRAIL_ROUTE_COLORS.length] ?? TRAIL_ROUTE_COLORS[0];
}

function toTrailPosition(aircraft: Aircraft): TrailPosition {
  return {
    lat: aircraft.lat,
    lon: aircraft.lon,
    altitude: aircraft.altitude ?? null,
    heading: aircraft.heading ?? null,
    eventTime: aircraft.lastSeen,
  };
}

function normalizeIcao(icao: string): string {
  return icao.toUpperCase();
}

function buildActiveTrailState(
  trailRoutes: Record<string, TrailRoute>,
  activeIcao: string | null,
  currentIndex = 0,
  isPlaying = false,
): Pick<AircraftState, "trailIcao" | "trailPositions" | "trailPlaybackIndex" | "isTrailPlaying"> {
  if (!activeIcao) {
    return createEmptyTrailState();
  }

  const activeRoute = trailRoutes[activeIcao];
  if (!activeRoute) {
    return createEmptyTrailState();
  }

  const trailPlaybackIndex =
    activeRoute.positions.length === 0
      ? 0
      : Math.max(0, Math.min(currentIndex, activeRoute.positions.length - 1));

  return {
    trailIcao: activeIcao,
    trailPositions: activeRoute.positions,
    trailPlaybackIndex,
    isTrailPlaying: isPlaying && activeRoute.positions.length > 1,
  };
}

function getFallbackTrailIcao(trailRouteOrder: string[]): string | null {
  return trailRouteOrder[trailRouteOrder.length - 1] ?? null;
}

function mergeAircraftBatch(
  state: AircraftState,
  aircraftBatch: Aircraft[],
): Pick<AircraftState, "aircraft" | "trailPositions" | "trailRoutes"> {
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

    if (state.trailIcao && normalizeIcao(aircraft.icao) === state.trailIcao) {
      nextTrailPositions = [...nextTrailPositions, toTrailPosition(aircraft)];
    }
  }

  const nextTrailRoutes =
    state.trailIcao && state.trailRoutes[state.trailIcao]
      ? {
          ...state.trailRoutes,
          [state.trailIcao]: {
            ...state.trailRoutes[state.trailIcao],
            positions: nextTrailPositions,
          },
        }
      : state.trailRoutes;

  return {
    aircraft: nextAircraft,
    trailPositions: nextTrailPositions,
    trailRoutes: nextTrailRoutes,
  };
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: {},
  selectedIcao: null,
  detailIcao: null,
  trailIcao: null,
  trailPositions: [],
  trailPlaybackIndex: 0,
  isTrailPlaying: false,
  trailPlaybackSpeedMs: DEFAULT_TRAIL_PLAYBACK_SPEED_MS,
  trailRoutes: {},
  trailRouteOrder: [],

  upsertAircraft: (aircraft) =>
    set((state) => mergeAircraftBatch(state, [aircraft])),

  upsertAircraftBatch: (aircraftBatch) =>
    set((state) => mergeAircraftBatch(state, aircraftBatch)),

  selectAircraft: (icao) =>
    set((state) =>
      icao === null
        ? {
            selectedIcao: null,
            trailRoutes: {},
            trailRouteOrder: [],
            ...createEmptyTrailState(),
          }
        : {
            selectedIcao: icao,
          },
    ),

  showDetails: (icao) =>
    set({ detailIcao: icao }),

  hideDetails: () =>
    set({ detailIcao: null }),

  setTrail: (icao, positions) =>
    set((state) => {
      const normalizedIcao = normalizeIcao(icao);
      const existingRoute = state.trailRoutes[normalizedIcao];
      const trailRoutes = {
        ...state.trailRoutes,
        [normalizedIcao]: {
          icao: normalizedIcao,
          positions,
          color:
            existingRoute?.color ?? pickTrailRouteColor(Object.keys(state.trailRoutes).length),
        },
      };
      const trailRouteOrder = state.trailRouteOrder.includes(normalizedIcao)
        ? state.trailRouteOrder
        : [...state.trailRouteOrder, normalizedIcao];

      return {
        trailRoutes,
        trailRouteOrder,
        ...buildActiveTrailState(
          trailRoutes,
          normalizedIcao,
          Math.max(positions.length - 1, 0),
          false,
        ),
      };
    }),

  clearTrail: () =>
    set((state) => {
      if (!state.trailIcao) {
        return createEmptyTrailState();
      }

      const trailRoutes = { ...state.trailRoutes };
      delete trailRoutes[state.trailIcao];
      const trailRouteOrder = state.trailRouteOrder.filter((icao) => icao !== state.trailIcao);
      const nextActiveIcao = getFallbackTrailIcao(trailRouteOrder);

      return {
        trailRoutes,
        trailRouteOrder,
        ...buildActiveTrailState(trailRoutes, nextActiveIcao, 0, false),
      };
    }),

  setTrailPlaybackIndex: (index) =>
    set((state) => ({
      trailPlaybackIndex:
        state.trailPositions.length === 0
          ? 0
          : Math.max(0, Math.min(index, state.trailPositions.length - 1)),
      isTrailPlaying: false,
    })),

  playTrail: () =>
    set((state) => ({
      isTrailPlaying: state.trailPositions.length > 1,
    })),

  pauseTrail: () =>
    set({ isTrailPlaying: false }),

  toggleTrailPlayback: () =>
    set((state) => ({
      isTrailPlaying: state.trailPositions.length > 1 ? !state.isTrailPlaying : false,
    })),

  setTrailPlaybackSpeedMs: (speedMs) =>
    set({
      trailPlaybackSpeedMs: clampPlaybackSpeed(speedMs),
    }),

  setActiveTrail: (icao) =>
    set((state) => ({
      ...buildActiveTrailState(
        state.trailRoutes,
        state.trailRoutes[normalizeIcao(icao)] ? normalizeIcao(icao) : null,
        0,
        false,
      ),
    })),

  pruneStale: (maxAgeMs) =>
    set((state) => {
      const cutoff = Date.now() - maxAgeMs;
      const aircraft: Record<string, Aircraft> = {};
      for (const [icao, ac] of Object.entries(state.aircraft)) {
        if (ac.lastSeen >= cutoff) {
          aircraft[icao] = ac;
        }
      }

      const selectedIcao =
        state.selectedIcao !== null && !(state.selectedIcao in aircraft)
          ? null
          : state.selectedIcao;
      const trailRoutes = Object.fromEntries(
        Object.entries(state.trailRoutes).filter(([icao]) => icao in aircraft),
      );
      const trailRouteOrder = state.trailRouteOrder.filter((icao) => icao in aircraft);
      const nextActiveIcao =
        state.trailIcao && state.trailIcao in trailRoutes
          ? state.trailIcao
          : getFallbackTrailIcao(trailRouteOrder);

      return {
        aircraft,
        selectedIcao,
        trailRoutes,
        trailRouteOrder,
        ...buildActiveTrailState(
          trailRoutes,
          nextActiveIcao,
          state.trailPlaybackIndex,
          state.isTrailPlaying,
        ),
      };
    }),

  retainOnly: (icaos) =>
    set((state) => {
      const aircraft: Record<string, Aircraft> = {};
      for (const [icao, ac] of Object.entries(state.aircraft)) {
        if (icaos.has(icao.toLowerCase())) {
          aircraft[icao] = ac;
        }
      }

      const selectedIcao =
        state.selectedIcao !== null && !(state.selectedIcao in aircraft)
          ? null
          : state.selectedIcao;
      const trailRoutes = Object.fromEntries(
        Object.entries(state.trailRoutes).filter(([icao]) => icao in aircraft),
      );
      const trailRouteOrder = state.trailRouteOrder.filter((icao) => icao in aircraft);
      const nextActiveIcao =
        state.trailIcao && state.trailIcao in trailRoutes
          ? state.trailIcao
          : getFallbackTrailIcao(trailRouteOrder);

      return {
        aircraft,
        selectedIcao,
        trailRoutes,
        trailRouteOrder,
        ...buildActiveTrailState(
          trailRoutes,
          nextActiveIcao,
          state.trailPlaybackIndex,
          state.isTrailPlaying,
        ),
      };
    }),
}));
