import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDefault } from "./registry";
import { useBaseLayerStore } from "./useBaseLayerStore";

describe("useBaseLayerStore", () => {
  let originalProviderId = getDefault().id;

  beforeEach(() => {
    originalProviderId = getDefault().id;
    useBaseLayerStore.setState({ activeProviderId: originalProviderId });
  });

  afterEach(() => {
    useBaseLayerStore.setState({ activeProviderId: originalProviderId });
  });

  test("setProvider keeps a known provider id", () => {
    useBaseLayerStore.getState().setProvider("esri-satellite");

    expect(useBaseLayerStore.getState().activeProviderId).toBe("esri-satellite");
  });

  test("setProvider falls back to default for unknown provider id", () => {
    useBaseLayerStore.getState().setProvider("unknown-provider");

    expect(useBaseLayerStore.getState().activeProviderId).toBe(getDefault().id);
  });
});
