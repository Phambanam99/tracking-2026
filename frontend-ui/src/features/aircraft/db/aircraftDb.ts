import { normalizeIcaoHex } from "./icaoRanges";

export type AircraftDbEntry = {
  registration?: string | null;
  aircraftType?: string | null;
  operator?: string | null;
  countryCode?: string | null;
  countryFlagUrl?: string | null;
};

type AircraftDbShard = Record<string, AircraftDbEntry>;

const shardModules = import.meta.glob<{ default: AircraftDbShard }>("./shards/*.json");
const shardCache = new Map<string, AircraftDbShard>();
const pendingShardLoads = new Map<string, Promise<AircraftDbShard>>();

function getShardKey(icao: string): string | null {
  const normalized = normalizeIcaoHex(icao);
  return normalized ? normalized.charAt(0) : null;
}

async function loadShardByKey(shardKey: string): Promise<AircraftDbShard> {
  const cached = shardCache.get(shardKey);
  if (cached) {
    return cached;
  }

  const pending = pendingShardLoads.get(shardKey);
  if (pending) {
    return pending;
  }

  const loader = shardModules[`./shards/${shardKey}.json`];
  if (!loader) {
    const emptyShard: AircraftDbShard = {};
    shardCache.set(shardKey, emptyShard);
    return emptyShard;
  }

  const shardPromise = loader()
    .then((module) => module.default ?? {})
    .then((shard) => {
      shardCache.set(shardKey, shard);
      return shard;
    })
    .catch((error) => {
      console.warn(`[aircraftDb] Failed to load shard ${shardKey}`, error);
      return {} as AircraftDbShard;
    })
    .finally(() => {
      pendingShardLoads.delete(shardKey);
    });

  pendingShardLoads.set(shardKey, shardPromise);
  return shardPromise;
}

export function preloadAircraftDbEntry(icao: string): void {
  const shardKey = getShardKey(icao);
  if (!shardKey) {
    return;
  }

  void loadShardByKey(shardKey);
}

export async function loadAircraftDbEntry(icao: string): Promise<AircraftDbEntry | null> {
  const normalized = normalizeIcaoHex(icao);
  if (!normalized) {
    return null;
  }

  const shard = await loadShardByKey(normalized.charAt(0));
  return shard[normalized] ?? null;
}

export function lookupAircraftDbEntry(icao: string): AircraftDbEntry | null {
  const normalized = normalizeIcaoHex(icao);
  if (!normalized) {
    return null;
  }

  const shardKey = normalized.charAt(0);
  const shard = shardCache.get(shardKey);
  if (!shard) {
    preloadAircraftDbEntry(normalized);
    return null;
  }

  return shard[normalized] ?? null;
}

export function resetAircraftDbCache(): void {
  shardCache.clear();
  pendingShardLoads.clear();
}
