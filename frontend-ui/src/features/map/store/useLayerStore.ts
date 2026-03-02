import { create } from "zustand";

export type LayerId = "live" | "watchlist" | "trail" | "military";
export type AircraftFilter = "all" | "watchlist";

type LayerState = {
  visible: Record<LayerId, boolean>;
  aircraftFilter: AircraftFilter;
  toggle: (id: LayerId) => void;
  setAircraftFilter: (filter: AircraftFilter) => void;
};

export const useLayerStore = create<LayerState>((set) => ({
  visible: {
    live: true,
    watchlist: true,
    trail: true,
    military: false,
  },
  aircraftFilter: "all",
  toggle: (id) =>
    set((state) => ({
      visible: {
        ...state.visible,
        [id]: !state.visible[id],
      },
    })),
  setAircraftFilter: (aircraftFilter) => set({ aircraftFilter }),
}));
