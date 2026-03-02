import { httpRequest } from "../../../shared/api/httpClient";
import type {
  AddAircraftRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  WatchlistEntry,
  WatchlistGroup,
} from "../types/watchlistTypes";

const BASE = "/api/v1/watchlist";

export async function fetchGroups(): Promise<WatchlistGroup[]> {
  return httpRequest<WatchlistGroup[]>({ path: BASE, method: "GET" });
}

export async function fetchGroupWithEntries(groupId: number): Promise<WatchlistGroup> {
  return httpRequest<WatchlistGroup>({ path: `${BASE}/${groupId}`, method: "GET" });
}

export async function createGroup(req: CreateGroupRequest): Promise<WatchlistGroup> {
  return httpRequest<WatchlistGroup>({ path: BASE, method: "POST", body: req });
}

export async function updateGroup(groupId: number, req: UpdateGroupRequest): Promise<WatchlistGroup> {
  return httpRequest<WatchlistGroup>({ path: `${BASE}/${groupId}`, method: "PUT", body: req });
}

export async function deleteGroup(groupId: number): Promise<void> {
  await httpRequest<void>({ path: `${BASE}/${groupId}`, method: "DELETE" });
}

export async function addAircraft(groupId: number, req: AddAircraftRequest): Promise<WatchlistEntry> {
  return httpRequest<WatchlistEntry>({
    path: `${BASE}/${groupId}/aircraft`,
    method: "POST",
    body: req,
  });
}

export async function addAircraftBatch(
  groupId: number,
  entries: AddAircraftRequest[],
): Promise<WatchlistEntry[]> {
  return httpRequest<WatchlistEntry[]>({
    path: `${BASE}/${groupId}/aircraft/batch`,
    method: "POST",
    body: { entries },
  });
}

export async function removeAircraft(groupId: number, icao: string): Promise<void> {
  await httpRequest<void>({
    path: `${BASE}/${groupId}/aircraft/${icao}`,
    method: "DELETE",
  });
}
