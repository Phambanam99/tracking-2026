import { create } from "zustand";
import {
  clearTrackedShipSnapshot,
  DEFAULT_TRACKED_SHIP_GROUP_COLOR,
  DEFAULT_TRACKED_SHIP_GROUP_ID,
  loadTrackedShipSnapshot,
  saveTrackedShipSnapshot,
  type TrackedShipGroup,
} from "./trackedShipStorage";

type TrackedShipState = {
  groups: TrackedShipGroup[];
  activeGroupId: string;
  trackedMmsis: Record<string, true>;
  addTrackedShip: (mmsi: string, groupId?: string) => void;
  removeTrackedShip: (mmsi: string, groupId?: string) => void;
  toggleTrackedShip: (mmsi: string, groupId?: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  moveShipToGroup: (mmsi: string, fromGroupId: string, toGroupId: string) => void;
  isTracked: (mmsi: string) => boolean;
  clearTrackedShips: () => void;
  createGroup: (name: string, color?: string) => void;
  setActiveGroup: (groupId: string) => void;
  toggleGroupVisibility: (groupId: string) => void;
  getVisibleTrackedMmsis: () => Set<string>;
  getGroupsForShip: (mmsi: string) => TrackedShipGroup[];
};

function buildTrackedMmsis(groups: TrackedShipGroup[]): Record<string, true> {
  return Object.fromEntries(
    groups.flatMap((group) => group.mmsis.map((mmsi) => [mmsi, true] as const)),
  );
}

function persist(groups: TrackedShipGroup[], activeGroupId: string): void {
  saveTrackedShipSnapshot({
    version: 2,
    activeGroupId,
    groups,
  });
}

function findGroup(groups: TrackedShipGroup[], groupId: string): TrackedShipGroup | undefined {
  return groups.find((group) => group.id === groupId);
}

function resolveTargetGroupId(groups: TrackedShipGroup[], requestedGroupId: string | undefined, activeGroupId: string): string {
  if (requestedGroupId && findGroup(groups, requestedGroupId)) {
    return requestedGroupId;
  }

  if (findGroup(groups, activeGroupId)) {
    return activeGroupId;
  }

  return groups[0]?.id ?? DEFAULT_TRACKED_SHIP_GROUP_ID;
}

function sanitizeGroupName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Tracked group";
}

function addShipToGroup(groups: TrackedShipGroup[], mmsi: string, targetGroupId: string): TrackedShipGroup[] {
  return groups.map((group) => {
    if (group.id !== targetGroupId || group.mmsis.includes(mmsi)) {
      return group;
    }

    return {
      ...group,
      mmsis: [...group.mmsis, mmsi],
    };
  });
}

function removeShipFromGroup(groups: TrackedShipGroup[], mmsi: string, targetGroupId: string): TrackedShipGroup[] {
  return groups.map((group) => {
    if (group.id !== targetGroupId || !group.mmsis.includes(mmsi)) {
      return group;
    }

    return {
      ...group,
      mmsis: group.mmsis.filter((value) => value !== mmsi),
    };
  });
}

export const useTrackedShipStore = create<TrackedShipState>((set, get) => {
  const snapshot = loadTrackedShipSnapshot();
  const initialGroups = snapshot.groups;

  return {
    groups: initialGroups,
    activeGroupId: snapshot.activeGroupId,
    trackedMmsis: buildTrackedMmsis(initialGroups),

    addTrackedShip: (mmsi, groupId) =>
      set((state) => {
        const targetGroupId = resolveTargetGroupId(state.groups, groupId, state.activeGroupId);
        const nextGroups = addShipToGroup(state.groups, mmsi, targetGroupId);
        persist(nextGroups, state.activeGroupId);
        return {
          groups: nextGroups,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    removeTrackedShip: (mmsi, groupId) =>
      set((state) => {
        const targetGroupId = resolveTargetGroupId(state.groups, groupId, state.activeGroupId);
        const nextGroups = removeShipFromGroup(state.groups, mmsi, targetGroupId);
        persist(nextGroups, state.activeGroupId);
        return {
          groups: nextGroups,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    toggleTrackedShip: (mmsi, groupId) =>
      set((state) => {
        const targetGroupId = resolveTargetGroupId(state.groups, groupId, state.activeGroupId);
        const targetGroup = findGroup(state.groups, targetGroupId);
        const nextGroups = targetGroup?.mmsis.includes(mmsi)
          ? removeShipFromGroup(state.groups, mmsi, targetGroupId)
          : addShipToGroup(state.groups, mmsi, targetGroupId);

        persist(nextGroups, state.activeGroupId);
        return {
          groups: nextGroups,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    renameGroup: (groupId, name) =>
      set((state) => {
        const nextGroups = state.groups.map((group) =>
          group.id === groupId
            ? { ...group, name: sanitizeGroupName(name) }
            : group,
        );
        persist(nextGroups, state.activeGroupId);
        return { groups: nextGroups };
      }),

    deleteGroup: (groupId) =>
      set((state) => {
        if (groupId === DEFAULT_TRACKED_SHIP_GROUP_ID || state.groups.length <= 1) {
          return state;
        }

        const nextGroups = state.groups.filter((group) => group.id !== groupId);
        const activeGroupId = state.activeGroupId === groupId
          ? (nextGroups[0]?.id ?? DEFAULT_TRACKED_SHIP_GROUP_ID)
          : state.activeGroupId;

        persist(nextGroups, activeGroupId);
        return {
          groups: nextGroups,
          activeGroupId,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    moveShipToGroup: (mmsi, fromGroupId, toGroupId) =>
      set((state) => {
        if (fromGroupId === toGroupId || !findGroup(state.groups, toGroupId)) {
          return state;
        }

        const nextGroups = state.groups.map((group) => {
          if (group.id === fromGroupId) {
            return {
              ...group,
              mmsis: group.mmsis.filter((value) => value !== mmsi),
            };
          }

          if (group.id === toGroupId) {
            return {
              ...group,
              mmsis: group.mmsis.includes(mmsi) ? group.mmsis : [...group.mmsis, mmsi],
            };
          }

          return group;
        });

        persist(nextGroups, state.activeGroupId);
        return {
          groups: nextGroups,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    isTracked: (mmsi) => Boolean(get().trackedMmsis[mmsi]),

    clearTrackedShips: () => {
      clearTrackedShipSnapshot();
      set({
        groups: [{
          id: DEFAULT_TRACKED_SHIP_GROUP_ID,
          name: "Default",
          color: DEFAULT_TRACKED_SHIP_GROUP_COLOR,
          mmsis: [],
          visibleOnMap: true,
        }],
        activeGroupId: DEFAULT_TRACKED_SHIP_GROUP_ID,
        trackedMmsis: {},
      });
    },

    createGroup: (name, color = DEFAULT_TRACKED_SHIP_GROUP_COLOR) =>
      set((state) => {
        const groupId = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const nextGroups = [
          ...state.groups,
          {
            id: groupId,
            name: sanitizeGroupName(name),
            color,
            mmsis: [],
            visibleOnMap: true,
          },
        ];
        persist(nextGroups, groupId);
        return {
          groups: nextGroups,
          activeGroupId: groupId,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    setActiveGroup: (groupId) =>
      set((state) => {
        const activeGroupId = findGroup(state.groups, groupId)?.id ?? state.activeGroupId;
        persist(state.groups, activeGroupId);
        return { activeGroupId };
      }),

    toggleGroupVisibility: (groupId) =>
      set((state) => {
        const nextGroups = state.groups.map((group) =>
          group.id === groupId ? { ...group, visibleOnMap: !group.visibleOnMap } : group,
        );
        persist(nextGroups, state.activeGroupId);
        return {
          groups: nextGroups,
          trackedMmsis: buildTrackedMmsis(nextGroups),
        };
      }),

    getVisibleTrackedMmsis: () => {
      const mmsis = new Set<string>();
      for (const group of get().groups) {
        if (!group.visibleOnMap) {
          continue;
        }
        for (const mmsi of group.mmsis) {
          mmsis.add(mmsi);
        }
      }
      return mmsis;
    },

    getGroupsForShip: (mmsi) => get().groups.filter((group) => group.mmsis.includes(mmsi)),
  };
});
