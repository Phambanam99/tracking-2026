export interface WatchlistGroup {
  id: number;
  name: string;
  /** Color hex, e.g. "#3b82f6" */
  color: string;
  entryCount: number;
  /** Loaded on demand via GET /{groupId} */
  entries?: WatchlistEntry[];
  createdAt: string;
  updatedAt: string;
  /** Client-side only — controls map highlight */
  visibleOnMap: boolean;
}

export interface WatchlistEntry {
  id: number;
  groupId: number;
  icao: string;
  note?: string | null;
  addedAt: string;
}

export interface CreateGroupRequest {
  name: string;
  color?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  color?: string;
}

export interface AddAircraftRequest {
  icao: string;
  note?: string;
}
