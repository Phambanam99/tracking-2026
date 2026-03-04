export const TRACKED_SHIP_STORAGE_KEY = "tracking_ship_tracked_mmsis";
export const DEFAULT_TRACKED_SHIP_GROUP_ID = "default";
export const DEFAULT_TRACKED_SHIP_GROUP_COLOR = "#f59e0b";

export type TrackedShipGroup = {
  id: string;
  name: string;
  color: string;
  mmsis: string[];
  visibleOnMap: boolean;
};

export type TrackedShipStorageSnapshot = {
  version: 2;
  activeGroupId: string;
  groups: TrackedShipGroup[];
};

function toUniqueMmsis(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
  );
}

function createDefaultGroup(mmsis: string[] = []): TrackedShipGroup {
  return {
    id: DEFAULT_TRACKED_SHIP_GROUP_ID,
    name: "Default",
    color: DEFAULT_TRACKED_SHIP_GROUP_COLOR,
    mmsis: toUniqueMmsis(mmsis),
    visibleOnMap: true,
  };
}

function normalizeGroup(input: unknown): TrackedShipGroup | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const group = input as Partial<TrackedShipGroup>;
  if (typeof group.id !== "string" || group.id.trim().length === 0) {
    return null;
  }
  if (typeof group.name !== "string" || group.name.trim().length === 0) {
    return null;
  }
  if (typeof group.color !== "string" || group.color.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(group.mmsis)) {
    return null;
  }

  return {
    id: group.id,
    name: group.name,
    color: group.color,
    mmsis: toUniqueMmsis(group.mmsis),
    visibleOnMap: group.visibleOnMap ?? true,
  };
}

function normalizeSnapshot(input: unknown): TrackedShipStorageSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const snapshot = input as Partial<TrackedShipStorageSnapshot>;
  if (snapshot.version !== 2 || !Array.isArray(snapshot.groups) || typeof snapshot.activeGroupId !== "string") {
    return null;
  }

  const groups = snapshot.groups
    .map(normalizeGroup)
    .filter((group): group is TrackedShipGroup => group !== null);
  if (groups.length === 0) {
    return null;
  }

  const activeGroupId = groups.some((group) => group.id === snapshot.activeGroupId)
    ? snapshot.activeGroupId
    : groups[0]?.id ?? DEFAULT_TRACKED_SHIP_GROUP_ID;

  return {
    version: 2,
    activeGroupId,
    groups,
  };
}

export function loadTrackedShipSnapshot(): TrackedShipStorageSnapshot {
  const raw = storage()?.getItem(TRACKED_SHIP_STORAGE_KEY);
  if (!raw) {
    return {
      version: 2,
      activeGroupId: DEFAULT_TRACKED_SHIP_GROUP_ID,
      groups: [createDefaultGroup()],
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return {
        version: 2,
        activeGroupId: DEFAULT_TRACKED_SHIP_GROUP_ID,
        groups: [createDefaultGroup(parsed as string[])],
      };
    }

    const snapshot = normalizeSnapshot(parsed);
    if (snapshot) {
      return snapshot;
    }
  } catch {
    // fall through to cleanup below
  }

  storage()?.removeItem(TRACKED_SHIP_STORAGE_KEY);
  return {
    version: 2,
    activeGroupId: DEFAULT_TRACKED_SHIP_GROUP_ID,
    groups: [createDefaultGroup()],
  };
}

export function saveTrackedShipSnapshot(snapshot: TrackedShipStorageSnapshot): void {
  storage()?.setItem(TRACKED_SHIP_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearTrackedShipSnapshot(): void {
  storage()?.removeItem(TRACKED_SHIP_STORAGE_KEY);
}

function storage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}
