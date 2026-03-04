import { describe, expect, test } from "vitest";
import { useTrackedShipStore } from "./useTrackedShipStore";

describe("useTrackedShipStore", () => {
  test("toggles tracked ship membership in the active group", () => {
    useTrackedShipStore.setState({
      groups: [{
        id: "default",
        name: "Default",
        color: "#f59e0b",
        mmsis: [],
        visibleOnMap: true,
      }],
      activeGroupId: "default",
      trackedMmsis: {},
    });

    useTrackedShipStore.getState().toggleTrackedShip("413387870");
    expect(useTrackedShipStore.getState().isTracked("413387870")).toBe(true);

    useTrackedShipStore.getState().toggleTrackedShip("413387870");
    expect(useTrackedShipStore.getState().isTracked("413387870")).toBe(false);
  });

  test("adds and removes tracked ship in an explicit group", () => {
    useTrackedShipStore.setState({
      groups: [
        { id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true },
        { id: "ops", name: "Ops", color: "#22d3ee", mmsis: [], visibleOnMap: true },
      ],
      activeGroupId: "default",
      trackedMmsis: {},
    });

    useTrackedShipStore.getState().addTrackedShip("413387870", "ops");
    expect(useTrackedShipStore.getState().groups.find((group) => group.id === "ops")?.mmsis).toEqual(["413387870"]);

    useTrackedShipStore.getState().removeTrackedShip("413387870", "ops");
    expect(useTrackedShipStore.getState().groups.find((group) => group.id === "ops")?.mmsis).toEqual([]);
  });

  test("creates groups and keeps visible tracked ships selector", () => {
    useTrackedShipStore.setState({
      groups: [{
        id: "default",
        name: "Default",
        color: "#f59e0b",
        mmsis: ["413387870"],
        visibleOnMap: true,
      }],
      activeGroupId: "default",
      trackedMmsis: { "413387870": true },
    });

    useTrackedShipStore.getState().createGroup("Priority");
    const priorityGroup = useTrackedShipStore.getState().groups.find((group) => group.name === "Priority");
    expect(priorityGroup).toBeDefined();

    if (!priorityGroup) {
      return;
    }

    useTrackedShipStore.getState().toggleTrackedShip("574001230", priorityGroup.id);
    expect(useTrackedShipStore.getState().getVisibleTrackedMmsis()).toEqual(new Set(["413387870", "574001230"]));

    useTrackedShipStore.getState().toggleGroupVisibility(priorityGroup.id);
    expect(useTrackedShipStore.getState().getVisibleTrackedMmsis()).toEqual(new Set(["413387870"]));
  });

  test("renames, moves, and deletes non-default groups", () => {
    useTrackedShipStore.setState({
      groups: [
        { id: "default", name: "Default", color: "#f59e0b", mmsis: ["413387870"], visibleOnMap: true },
        { id: "priority", name: "Priority", color: "#22d3ee", mmsis: [], visibleOnMap: true },
      ],
      activeGroupId: "priority",
      trackedMmsis: { "413387870": true },
    });

    useTrackedShipStore.getState().moveShipToGroup("413387870", "default", "priority");
    expect(useTrackedShipStore.getState().groups.find((group) => group.id === "default")?.mmsis).toEqual([]);
    expect(useTrackedShipStore.getState().groups.find((group) => group.id === "priority")?.mmsis).toEqual(["413387870"]);

    useTrackedShipStore.getState().renameGroup("priority", "Ops");
    expect(useTrackedShipStore.getState().groups.find((group) => group.id === "priority")?.name).toBe("Ops");

    useTrackedShipStore.getState().deleteGroup("priority");
    expect(useTrackedShipStore.getState().groups).toHaveLength(1);
  });
});
