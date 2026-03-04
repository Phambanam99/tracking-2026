import { create } from "zustand";

export type ShipLayerId = "ships" | "labels" | "trail";

type ShipLayerState = {
  visible: Record<ShipLayerId, boolean>;
  followSelected: boolean;
  trackedOnly: boolean;
  trackedGroupFilterIds: string[];
  toggle: (id: ShipLayerId) => void;
  setFollowSelected: (enabled: boolean) => void;
  setTrackedOnly: (enabled: boolean) => void;
  toggleTrackedGroupFilterId: (groupId: string) => void;
  clearTrackedGroupFilter: () => void;
};

export const useShipLayerStore = create<ShipLayerState>((set) => ({
  visible: {
    ships: true,
    labels: true,
    trail: true,
  },
  followSelected: false,
  trackedOnly: false,
  trackedGroupFilterIds: [],
  toggle: (id) =>
    set((state) => ({
      visible: {
        ...state.visible,
        [id]: !state.visible[id],
      },
  })),
  setFollowSelected: (followSelected) => set({ followSelected }),
  setTrackedOnly: (trackedOnly) => set({ trackedOnly }),
  toggleTrackedGroupFilterId: (groupId) =>
    set((state) => ({
      trackedGroupFilterIds: state.trackedGroupFilterIds.includes(groupId)
        ? state.trackedGroupFilterIds.filter((id) => id !== groupId)
        : [...state.trackedGroupFilterIds, groupId],
    })),
  clearTrackedGroupFilter: () => set({ trackedGroupFilterIds: [] }),
}));
