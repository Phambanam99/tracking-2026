import { describe, expect, test } from "vitest";
import { useShipLayerStore } from "./useShipLayerStore";

describe("useShipLayerStore", () => {
  test("toggles ship layer visibility and follow mode", () => {
    useShipLayerStore.setState({
      visible: {
        ships: true,
        labels: true,
        trail: true,
      },
      followSelected: false,
      trackedOnly: false,
      trackedGroupFilterIds: [],
    });

    useShipLayerStore.getState().toggle("labels");
    useShipLayerStore.getState().setFollowSelected(true);
    useShipLayerStore.getState().setTrackedOnly(true);
    useShipLayerStore.getState().toggleTrackedGroupFilterId("default");
    useShipLayerStore.getState().toggleTrackedGroupFilterId("ops");

    expect(useShipLayerStore.getState().visible.labels).toBe(false);
    expect(useShipLayerStore.getState().followSelected).toBe(true);
    expect(useShipLayerStore.getState().trackedOnly).toBe(true);
    expect(useShipLayerStore.getState().trackedGroupFilterIds).toEqual(["default", "ops"]);

    useShipLayerStore.getState().toggleTrackedGroupFilterId("default");
    expect(useShipLayerStore.getState().trackedGroupFilterIds).toEqual(["ops"]);

    useShipLayerStore.getState().clearTrackedGroupFilter();
    expect(useShipLayerStore.getState().trackedGroupFilterIds).toEqual([]);
  });
});
