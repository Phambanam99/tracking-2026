import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useWatchlistStore } from "../store/useWatchlistStore";
import type { WatchlistEntry, WatchlistGroup } from "../types/watchlistTypes";
import { WatchlistAircraftRow } from "./WatchlistAircraftRow";

function makeEntry(overrides: Partial<WatchlistEntry> = {}): WatchlistEntry {
  return {
    id: 1,
    groupId: 10,
    icao: "abc123",
    note: "note",
    addedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeGroup(overrides: Partial<WatchlistGroup> = {}): WatchlistGroup {
  return {
    id: 10,
    name: "Alpha",
    color: "#3b82f6",
    entryCount: 1,
    entries: [makeEntry()],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    visibleOnMap: true,
    ...overrides,
  };
}

describe("WatchlistAircraftRow", () => {
  beforeEach(() => {
    useWatchlistStore.setState({
      groups: [],
      loading: false,
      error: null,
    });
  });

  test("moves an aircraft to another group", async () => {
    const addAircraft = vi.fn().mockResolvedValue(undefined);
    const removeAircraft = vi.fn().mockResolvedValue(undefined);
    useWatchlistStore.setState({
      groups: [
        makeGroup({ id: 10, name: "Alpha" }),
        makeGroup({ id: 20, name: "Bravo", entries: [] }),
      ],
      addAircraft,
      removeAircraft,
    });

    render(<WatchlistAircraftRow entry={makeEntry()} groupId={10} />);

    fireEvent.click(screen.getByLabelText("Move abc123 to another group"));
    fireEvent.click(screen.getByRole("button", { name: "Bravo" }));

    await waitFor(() => {
      expect(addAircraft).toHaveBeenCalledWith(20, "abc123", "note");
      expect(removeAircraft).toHaveBeenCalledWith(10, "abc123");
    });
    expect(addAircraft.mock.invocationCallOrder[0]).toBeLessThan(removeAircraft.mock.invocationCallOrder[0]);
  });

  test("hides the move action when there is no eligible target group", () => {
    useWatchlistStore.setState({
      groups: [makeGroup({ id: 10, name: "Alpha" })],
    });

    render(<WatchlistAircraftRow entry={makeEntry()} groupId={10} />);

    expect(screen.queryByLabelText("Move abc123 to another group")).toBeNull();
  });
});
