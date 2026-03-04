import { afterEach, describe, expect, test } from "vitest";
import {
  clearTrackedShipSnapshot,
  DEFAULT_TRACKED_SHIP_GROUP_ID,
  loadTrackedShipSnapshot,
  saveTrackedShipSnapshot,
  TRACKED_SHIP_STORAGE_KEY,
} from "./trackedShipStorage";

describe("trackedShipStorage", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  test("persists grouped tracked ships in localStorage", () => {
    saveTrackedShipSnapshot({
      version: 2,
      activeGroupId: DEFAULT_TRACKED_SHIP_GROUP_ID,
      groups: [
        {
          id: DEFAULT_TRACKED_SHIP_GROUP_ID,
          name: "Default",
          color: "#f59e0b",
          mmsis: ["413387870", "574001230"],
          visibleOnMap: true,
        },
      ],
    });

    expect(window.localStorage.getItem(TRACKED_SHIP_STORAGE_KEY)).toContain("413387870");
    expect(loadTrackedShipSnapshot().groups[0]?.mmsis).toEqual(["413387870", "574001230"]);
  });

  test("migrates legacy flat tracked ship arrays", () => {
    window.localStorage.setItem(TRACKED_SHIP_STORAGE_KEY, JSON.stringify(["413387870"]));

    const snapshot = loadTrackedShipSnapshot();
    expect(snapshot.activeGroupId).toBe(DEFAULT_TRACKED_SHIP_GROUP_ID);
    expect(snapshot.groups[0]?.mmsis).toEqual(["413387870"]);
  });

  test("clears malformed storage payload", () => {
    window.localStorage.setItem(TRACKED_SHIP_STORAGE_KEY, "{bad-json");

    expect(loadTrackedShipSnapshot().groups[0]?.mmsis).toEqual([]);
    expect(window.localStorage.getItem(TRACKED_SHIP_STORAGE_KEY)).toBeNull();
  });

  test("removes tracked ships from storage", () => {
    saveTrackedShipSnapshot({
      version: 2,
      activeGroupId: DEFAULT_TRACKED_SHIP_GROUP_ID,
      groups: [
        {
          id: DEFAULT_TRACKED_SHIP_GROUP_ID,
          name: "Default",
          color: "#f59e0b",
          mmsis: ["413387870"],
          visibleOnMap: true,
        },
      ],
    });
    clearTrackedShipSnapshot();

    expect(window.localStorage.getItem(TRACKED_SHIP_STORAGE_KEY)).toBeNull();
  });
});
