import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useTrackingModeStore } from "./useTrackingModeStore";

describe("useTrackingModeStore", () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: "aircraft" });
  });

  afterEach(() => {
    useTrackingModeStore.setState({ mode: "aircraft" });
  });

  test("defaults to aircraft mode", () => {
    expect(useTrackingModeStore.getState().mode).toBe("aircraft");
  });

  test("updates the tracking mode", () => {
    useTrackingModeStore.getState().setMode("ship");

    expect(useTrackingModeStore.getState().mode).toBe("ship");
  });
});
