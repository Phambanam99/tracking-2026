import { create } from "zustand";
import * as api from "../api/watchlistApi";
import type { AddAircraftRequest, UpdateGroupRequest, WatchlistGroup } from "../types/watchlistTypes";

interface WatchlistState {
  groups: WatchlistGroup[];
  loading: boolean;
  error: string | null;

  // Server sync
  fetchGroups: () => Promise<void>;
  fetchGroupEntries: (groupId: number) => Promise<void>;
  createGroup: (name: string, color?: string) => Promise<void>;
  updateGroup: (groupId: number, updates: UpdateGroupRequest) => Promise<void>;
  deleteGroup: (groupId: number) => Promise<void>;
  addAircraft: (groupId: number, icao: string, note?: string) => Promise<void>;
  addAircraftBatch: (groupId: number, entries: AddAircraftRequest[]) => Promise<void>;
  removeAircraft: (groupId: number, icao: string) => Promise<void>;

  // Client-side UI
  toggleGroupVisibility: (groupId: number) => void;
  clearAll: () => void;

  // Selectors
  getVisibleIcaos: () => Set<string>;
  getGroupsForIcao: (icao: string) => WatchlistGroup[];
  getIcaoColor: (icao: string) => string | undefined;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  groups: [],
  loading: false,
  error: null,

  fetchGroups: async () => {
    set({ loading: true, error: null });
    try {
      const groups = await api.fetchGroups();
      set({ groups: groups.map((g) => ({ ...g, visibleOnMap: true })), loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchGroupEntries: async (groupId: number) => {
    const group = await api.fetchGroupWithEntries(groupId);
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, entries: group.entries, entryCount: group.entryCount } : g,
      ),
    }));
  },

  createGroup: async (name: string, color?: string) => {
    const group = await api.createGroup({ name, color });
    set((state) => ({
      groups: [...state.groups, { ...group, visibleOnMap: true }],
    }));
  },

  updateGroup: async (groupId: number, updates: UpdateGroupRequest) => {
    const updated = await api.updateGroup(groupId, updates);
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, ...updated, visibleOnMap: g.visibleOnMap } : g)),
    }));
  },

  deleteGroup: async (groupId: number) => {
    await api.deleteGroup(groupId);
    set((state) => ({ groups: state.groups.filter((g) => g.id !== groupId) }));
  },

  addAircraft: async (groupId: number, icao: string, note?: string) => {
    const entry = await api.addAircraft(groupId, { icao, note });
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          entryCount: g.entryCount + 1,
          entries: g.entries ? [...g.entries, entry] : [entry],
        };
      }),
    }));
  },

  addAircraftBatch: async (groupId: number, entries: AddAircraftRequest[]) => {
    const created = await api.addAircraftBatch(groupId, entries);
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          entryCount: g.entryCount + created.length,
          entries: g.entries ? [...g.entries, ...created] : created,
        };
      }),
    }));
  },

  removeAircraft: async (groupId: number, icao: string) => {
    await api.removeAircraft(groupId, icao);
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          entryCount: Math.max(0, g.entryCount - 1),
          entries: g.entries?.filter((e) => e.icao !== icao),
        };
      }),
    }));
  },

  toggleGroupVisibility: (groupId: number) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, visibleOnMap: !g.visibleOnMap } : g,
      ),
    }));
  },

  clearAll: () => set({ groups: [], loading: false, error: null }),

  getVisibleIcaos: () => {
    const { groups } = get();
    const icaos = new Set<string>();
    for (const g of groups) {
      if (g.visibleOnMap && g.entries) {
        for (const e of g.entries) icaos.add(e.icao);
      }
    }
    return icaos;
  },

  getGroupsForIcao: (icao: string) =>
    get().groups.filter((g) => g.entries?.some((e) => e.icao === icao)),

  getIcaoColor: (icao: string) => {
    for (const g of get().groups) {
      if (g.visibleOnMap && g.entries?.some((e) => e.icao === icao)) {
        return g.color;
      }
    }
    return undefined;
  },
}));
