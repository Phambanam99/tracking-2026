export type AircraftPerfSnapshot = {
  enabled: boolean;
  socketMessages: number;
  socketBatches: number;
  socketLastBatchSize: number;
  socketMaxBatchSize: number;
  socketLastFlushMs: number;
  socketMaxFlushMs: number;
  layerSyncs: number;
  layerLastFeatureCount: number;
  layerMaxFeatureCount: number;
  layerLastSyncMs: number;
  layerMaxSyncMs: number;
  lastUpdatedAt: number | null;
};

declare global {
  interface Window {
    __trackingAircraftPerf__?: AircraftPerfSnapshot;
  }
}

const DEFAULT_SNAPSHOT: AircraftPerfSnapshot = {
  enabled: false,
  socketMessages: 0,
  socketBatches: 0,
  socketLastBatchSize: 0,
  socketMaxBatchSize: 0,
  socketLastFlushMs: 0,
  socketMaxFlushMs: 0,
  layerSyncs: 0,
  layerLastFeatureCount: 0,
  layerMaxFeatureCount: 0,
  layerLastSyncMs: 0,
  layerMaxSyncMs: 0,
  lastUpdatedAt: null,
};

let snapshot: AircraftPerfSnapshot = { ...DEFAULT_SNAPSHOT };
let enabledOverride: boolean | null = null;

export function isAircraftPerfEnabled(): boolean {
  return enabledOverride ?? import.meta.env.VITE_AIRCRAFT_PERF_DEBUG === "true";
}

export function recordSocketFlush(batchSize: number, durationMs: number): void {
  if (!isAircraftPerfEnabled()) {
    return;
  }

  snapshot = {
    ...snapshot,
    enabled: true,
    socketMessages: snapshot.socketMessages + batchSize,
    socketBatches: snapshot.socketBatches + 1,
    socketLastBatchSize: batchSize,
    socketMaxBatchSize: Math.max(snapshot.socketMaxBatchSize, batchSize),
    socketLastFlushMs: durationMs,
    socketMaxFlushMs: Math.max(snapshot.socketMaxFlushMs, durationMs),
    lastUpdatedAt: Date.now(),
  };
  publishSnapshot();
}

export function recordLayerSync(featureCount: number, durationMs: number): void {
  if (!isAircraftPerfEnabled()) {
    return;
  }

  snapshot = {
    ...snapshot,
    enabled: true,
    layerSyncs: snapshot.layerSyncs + 1,
    layerLastFeatureCount: featureCount,
    layerMaxFeatureCount: Math.max(snapshot.layerMaxFeatureCount, featureCount),
    layerLastSyncMs: durationMs,
    layerMaxSyncMs: Math.max(snapshot.layerMaxSyncMs, durationMs),
    lastUpdatedAt: Date.now(),
  };
  publishSnapshot();
}

export function getAircraftPerfSnapshot(): AircraftPerfSnapshot {
  return { ...snapshot, enabled: isAircraftPerfEnabled() };
}

export function resetAircraftPerfTelemetry(): void {
  snapshot = { ...DEFAULT_SNAPSHOT, enabled: isAircraftPerfEnabled() };
  publishSnapshot();
}

export function setAircraftPerfEnabledForTest(value: boolean | null): void {
  enabledOverride = value;
  resetAircraftPerfTelemetry();
}

function publishSnapshot(): void {
  if (typeof window !== "undefined") {
    window.__trackingAircraftPerf__ = getAircraftPerfSnapshot();
  }
}
