import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useWatchlistStore } from "./useWatchlistStore";
import type { WatchlistGroup } from "../types/watchlistTypes";

function makeGroup(overrides: Partial<WatchlistGroup> = {}): WatchlistGroup {
  return {
    id: 1,
    name: "Test Group",
    color: "#3b82f6",
    entryCount: 0,
    entries: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    visibleOnMap: true,
    ...overrides,
  };
}

describe("useWatchlistStore", () => {
  beforeEach(() => {
    useWatchlistStore.setState({ groups: [], loading: false, error: null });
  });

  afterEach(() => {
    useWatchlistStore.setState({ groups: [], loading: false, error: null });
  });

  // -------------------------------------------------------------------------
  // toggleGroupVisibility
  // -------------------------------------------------------------------------

  test("toggleGroupVisibility flips visibleOnMap from true to false", () => {
    const group = makeGroup({ id: 1, visibleOnMap: true });
    useWatchlistStore.setState({ groups: [group] });

    useWatchlistStore.getState().toggleGroupVisibility(1);

    expect(useWatchlistStore.getState().groups[0].visibleOnMap).toBe(false);
  });

  test("toggleGroupVisibility flips visibleOnMap from false to true", () => {
    const group = makeGroup({ id: 2, visibleOnMap: false });
    useWatchlistStore.setState({ groups: [group] });

    useWatchlistStore.getState().toggleGroupVisibility(2);

    expect(useWatchlistStore.getState().groups[0].visibleOnMap).toBe(true);
  });

  test("toggleGroupVisibility does not affect other groups", () => {
    const g1 = makeGroup({ id: 1, visibleOnMap: true });
    const g2 = makeGroup({ id: 2, visibleOnMap: true });
    useWatchlistStore.setState({ groups: [g1, g2] });

    useWatchlistStore.getState().toggleGroupVisibility(1);

    expect(useWatchlistStore.getState().groups[0].visibleOnMap).toBe(false);
    expect(useWatchlistStore.getState().groups[1].visibleOnMap).toBe(true);
  });

  // -------------------------------------------------------------------------
  // clearAll
  // -------------------------------------------------------------------------

  test("clearAll empties groups and resets flags", () => {
    useWatchlistStore.setState({
      groups: [makeGroup()],
      loading: true,
      error: "some error",
    });

    useWatchlistStore.getState().clearAll();

    const state = useWatchlistStore.getState();
    expect(state.groups).toHaveLength(0);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // getVisibleIcaos
  // -------------------------------------------------------------------------

  test("getVisibleIcaos returns ICAOs from visible groups with entries", () => {
    const g1 = makeGroup({
      id: 1,
      visibleOnMap: true,
      entries: [
        { id: 1, groupId: 1, icao: "ABC123", note: null, addedAt: "" },
        { id: 2, groupId: 1, icao: "DEF456", note: null, addedAt: "" },
      ],
    });
    const g2 = makeGroup({
      id: 2,
      visibleOnMap: false,
      entries: [{ id: 3, groupId: 2, icao: "GHI789", note: null, addedAt: "" }],
    });
    useWatchlistStore.setState({ groups: [g1, g2] });

    const icaos = useWatchlistStore.getState().getVisibleIcaos();

    expect(icaos.has("abc123")).toBe(true);
    expect(icaos.has("def456")).toBe(true);
    expect(icaos.has("ghi789")).toBe(false); // hidden group
  });

  test("getVisibleIcaos returns empty set when no groups", () => {
    const icaos = useWatchlistStore.getState().getVisibleIcaos();
    expect(icaos.size).toBe(0);
  });

  // -------------------------------------------------------------------------
  // getGroupsForIcao
  // -------------------------------------------------------------------------

  test("getGroupsForIcao returns groups containing the ICAO", () => {
    const g1 = makeGroup({
      id: 1,
      entries: [{ id: 1, groupId: 1, icao: "ABC123", note: null, addedAt: "" }],
    });
    const g2 = makeGroup({
      id: 2,
      entries: [{ id: 2, groupId: 2, icao: "DEF456", note: null, addedAt: "" }],
    });
    useWatchlistStore.setState({ groups: [g1, g2] });

    const result = useWatchlistStore.getState().getGroupsForIcao("ABC123");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test("getGroupsForIcao returns empty array when ICAO not tracked", () => {
    useWatchlistStore.setState({ groups: [makeGroup({ entries: [] })] });

    const result = useWatchlistStore.getState().getGroupsForIcao("ZZZZZZ");

    expect(result).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // getIcaoColor
  // -------------------------------------------------------------------------

  test("getIcaoColor returns color from first visible group containing ICAO", () => {
    const g1 = makeGroup({
      id: 1,
      color: "#ef4444",
      visibleOnMap: true,
      entries: [{ id: 1, groupId: 1, icao: "ABC123", note: null, addedAt: "" }],
    });
    useWatchlistStore.setState({ groups: [g1] });

    const color = useWatchlistStore.getState().getIcaoColor("ABC123");

    expect(color).toBe("#ef4444");
  });

  test("getIcaoColor returns undefined for hidden group", () => {
    const g1 = makeGroup({
      id: 1,
      color: "#ef4444",
      visibleOnMap: false,
      entries: [{ id: 1, groupId: 1, icao: "ABC123", note: null, addedAt: "" }],
    });
    useWatchlistStore.setState({ groups: [g1] });

    const color = useWatchlistStore.getState().getIcaoColor("ABC123");

    expect(color).toBeUndefined();
  });

  test("getIcaoColor returns undefined when ICAO not tracked", () => {
    useWatchlistStore.setState({ groups: [makeGroup({ entries: [] })] });

    const color = useWatchlistStore.getState().getIcaoColor("ZZZZZZ");

    expect(color).toBeUndefined();
  });
});
