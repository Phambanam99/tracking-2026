import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WatchlistGroup } from "../types/watchlistTypes";
import { useWatchlistStore } from "../store/useWatchlistStore";

vi.mock("../../auth/store/useAuthStore", () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => boolean) =>
    selector({ isAuthenticated: true }),
}));

import { AddToWatchlistDropdown } from "./AddToWatchlistDropdown";

function makeGroup(overrides: Partial<WatchlistGroup> = {}): WatchlistGroup {
  return {
    id: 7,
    name: "Alpha",
    color: "#3b82f6",
    entryCount: 0,
    entries: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    visibleOnMap: true,
    ...overrides,
  };
}

describe("AddToWatchlistDropdown", () => {
  beforeEach(() => {
    useWatchlistStore.setState({
      groups: [],
      loading: false,
      error: null,
    });
  });

  test("creates a default group automatically when no groups exist", async () => {
    const createGroup = vi.fn().mockResolvedValue(makeGroup({ id: 11, name: "Default" }));
    const addAircraft = vi.fn().mockResolvedValue(undefined);
    useWatchlistStore.setState({
      createGroup,
      addAircraft,
    });

    render(<AddToWatchlistDropdown icao="ABC123" />);

    fireEvent.click(screen.getByRole("button", { name: "Add to Watchlist" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to Default group" }));

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith("Default", "#3b82f6");
      expect(addAircraft).toHaveBeenCalledWith(11, "abc123");
    });
    expect(screen.getByText("Added to Default group")).toBeInTheDocument();
  });

  test("adds the aircraft to the selected existing group", async () => {
    const addAircraft = vi.fn().mockResolvedValue(undefined);
    useWatchlistStore.setState({
      groups: [makeGroup({ id: 5, name: "Blue Team" })],
      addAircraft,
    });

    render(<AddToWatchlistDropdown icao="ABC123" />);

    fireEvent.click(screen.getByRole("button", { name: "Add to Watchlist" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue Team" }));

    await waitFor(() => {
      expect(addAircraft).toHaveBeenCalledWith(5, "abc123");
    });
    expect(screen.getByText("Added to Blue Team")).toBeInTheDocument();
  });
});
