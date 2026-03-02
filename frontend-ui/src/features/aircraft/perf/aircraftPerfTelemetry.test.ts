import { beforeEach, describe, expect, test } from "vitest";
import {
  getAircraftPerfSnapshot,
  recordLayerSync,
  recordSocketFlush,
  resetAircraftPerfTelemetry,
  setAircraftPerfEnabledForTest,
} from "./aircraftPerfTelemetry";

describe("aircraftPerfTelemetry", () => {
  beforeEach(() => {
    setAircraftPerfEnabledForTest(true);
    resetAircraftPerfTelemetry();
  });

  test("records socket flush metrics and exposes them on window", () => {
    recordSocketFlush(12, 4.5);

    const snapshot = getAircraftPerfSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.socketMessages).toBe(12);
    expect(snapshot.socketBatches).toBe(1);
    expect(snapshot.socketLastBatchSize).toBe(12);
    expect(snapshot.socketMaxBatchSize).toBe(12);
    expect(snapshot.socketLastFlushMs).toBe(4.5);
    expect(snapshot.socketMaxFlushMs).toBe(4.5);
    expect(window.__trackingAircraftPerf__).toMatchObject({
      socketMessages: 12,
      socketBatches: 1,
      socketLastBatchSize: 12,
    });
  });

  test("tracks layer sync maxima across multiple updates", () => {
    recordLayerSync(120, 3.2);
    recordLayerSync(80, 1.1);

    const snapshot = getAircraftPerfSnapshot();
    expect(snapshot.layerSyncs).toBe(2);
    expect(snapshot.layerLastFeatureCount).toBe(80);
    expect(snapshot.layerMaxFeatureCount).toBe(120);
    expect(snapshot.layerLastSyncMs).toBe(1.1);
    expect(snapshot.layerMaxSyncMs).toBe(3.2);
  });

  test("is a no-op when telemetry is disabled", () => {
    setAircraftPerfEnabledForTest(false);

    recordSocketFlush(5, 2);
    recordLayerSync(10, 1);

    expect(getAircraftPerfSnapshot()).toMatchObject({
      enabled: false,
      socketMessages: 0,
      socketBatches: 0,
      layerSyncs: 0,
    });
  });
});
