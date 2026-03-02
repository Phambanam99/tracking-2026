import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useWatchlistStore } from "../store/useWatchlistStore";
import { WatchlistPanel } from "./WatchlistPanel";
import type { WatchlistGroup } from "../types/watchlistTypes";

function makeGroup(overrides: Partial<WatchlistGroup> = {}): WatchlistGroup {
  return {
    id: 1,
    name: "Alpha Squad",
    color: "#3b82f6",
    entryCount: 2,
    entries: [
      { id: 1, groupId: 1, icao: "ABC123", note: "test note", addedAt: "" },
      { id: 2, groupId: 1, icao: "DEF456", note: null, addedAt: "" },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    visibleOnMap: true,
    ...overrides,
  };
}

describe("WatchlistPanel", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    useWatchlistStore.setState({ groups: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  test("renders panel header and close button", () => {
    render(<WatchlistPanel onClose={onClose} />);

    expect(screen.getByText("Watchlist")).toBeInTheDocument();
    expect(screen.getByLabelText("Close watchlist")).toBeInTheDocument();
  });

  test("calls onClose when close button clicked", () => {
    render(<WatchlistPanel onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close watchlist"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("shows empty state when no groups", () => {
    render(<WatchlistPanel onClose={onClose} />);

    expect(screen.getByText(/No groups yet/)).toBeInTheDocument();
  });

  test("renders group cards when groups are loaded", () => {
    useWatchlistStore.setState({ groups: [makeGroup()] });

    render(<WatchlistPanel onClose={onClose} />);

    expect(screen.getByText("Alpha Squad")).toBeInTheDocument();
  });

  test("shows loading indicator during fetch", () => {
    useWatchlistStore.setState({ loading: true });

    render(<WatchlistPanel onClose={onClose} />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("shows error message on fetch failure", () => {
    useWatchlistStore.setState({ error: "Network error" });

    render(<WatchlistPanel onClose={onClose} />);

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  test("shows create form when + button clicked", () => {
    render(<WatchlistPanel onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Create new group"));

    expect(screen.getByText("New Group")).toBeInTheDocument();
  });

  test("shows footer with group and aircraft count", () => {
    useWatchlistStore.setState({ groups: [makeGroup()] });

    render(<WatchlistPanel onClose={onClose} />);

    expect(screen.getByText(/1 group/)).toBeInTheDocument();
    expect(screen.getByText(/2 aircraft/)).toBeInTheDocument();
  });
});
