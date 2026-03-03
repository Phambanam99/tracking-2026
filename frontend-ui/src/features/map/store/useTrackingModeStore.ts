import { create } from "zustand";

export type TrackingMode = "aircraft" | "ship";

type TrackingModeState = {
  mode: TrackingMode;
  setMode: (mode: TrackingMode) => void;
};

export const useTrackingModeStore = create<TrackingModeState>((set) => ({
  mode: "aircraft",
  setMode: (mode) => set({ mode }),
}));
