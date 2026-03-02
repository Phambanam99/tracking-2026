import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useLayerStore } from "./useLayerStore";

describe("useLayerStore", () => {
  beforeEach(() => {
    useLayerStore.setState({
      visible: { live: true, watchlist: true, trail: true, military: false },
      aircraftFilter: "all",
    });
  });

  afterEach(() => {
    useLayerStore.setState({
      visible: { live: true, watchlist: true, trail: true, military: false },
      aircraftFilter: "all",
    });
  });

  test("toggle flips layer visibility", () => {
    useLayerStore.getState().toggle("trail");

    expect(useLayerStore.getState().visible.trail).toBe(false);
  });

  test("setAircraftFilter updates the live layer filter", () => {
    useLayerStore.getState().setAircraftFilter("watchlist");

    expect(useLayerStore.getState().aircraftFilter).toBe("watchlist");
  });

  test("military layer is off by default and can be toggled on", () => {
    expect(useLayerStore.getState().visible.military).toBe(false);

    useLayerStore.getState().toggle("military");

    expect(useLayerStore.getState().visible.military).toBe(true);
  });
});
