import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";
import { useLayerStore } from "../store/useLayerStore";
import { LayerPanel } from "./LayerPanel";

describe("LayerPanel", () => {
  beforeEach(() => {
    act(() => {
      useLayerStore.setState({
        visible: { live: true, watchlist: true, trail: true, military: false },
        aircraftFilter: "all",
      });
      useWatchlistStore.setState({
        groups: [],
        loading: false,
        error: null,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useLayerStore.setState({
        visible: { live: true, watchlist: true, trail: true, military: false },
        aircraftFilter: "all",
      });
      useWatchlistStore.setState({
        groups: [],
        loading: false,
        error: null,
      });
    });
  });

  test("renders layer controls after opening the panel", () => {
    render(<LayerPanel />);

    act(() => {
      fireEvent.click(screen.getByLabelText("Toggle layer panel"));
    });

    expect(screen.getByText("Live Aircraft")).toBeInTheDocument();
    expect(screen.getByText("Military Aircraft")).toBeInTheDocument();
    expect(screen.getByText("History Trail")).toBeInTheDocument();
    expect(screen.getByText("When enabled, only active backend-tagged military aircraft stay on the map.")).toBeInTheDocument();
  });

  test("checkbox toggles layer visibility in the store", () => {
    render(<LayerPanel />);

    act(() => {
      fireEvent.click(screen.getByLabelText("Toggle layer panel"));
    });
    act(() => {
      fireEvent.click(screen.getByRole("checkbox", { name: "History Trail" }));
    });

    expect(useLayerStore.getState().visible.trail).toBe(false);
  });

  test("live filter buttons update the aircraft filter", () => {
    render(<LayerPanel />);

    act(() => {
      fireEvent.click(screen.getByLabelText("Toggle layer panel"));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Watchlist only" }));
    });

    expect(useLayerStore.getState().aircraftFilter).toBe("watchlist");
  });

  test("shows empty watchlist group state when no groups exist", () => {
    render(<LayerPanel />);

    act(() => {
      fireEvent.click(screen.getByLabelText("Toggle layer panel"));
    });

    expect(screen.getByText("No watchlist groups yet")).toBeInTheDocument();
  });

  test("renders watchlist groups and toggles group visibility", () => {
    act(() => {
      useWatchlistStore.setState({
        groups: [
          {
            id: 7,
            name: "VIP",
            color: "#22c55e",
            entryCount: 2,
            visibleOnMap: true,
            createdAt: "2026-03-02T00:00:00Z",
            updatedAt: "2026-03-02T00:00:00Z",
            entries: [
              { id: 1, groupId: 7, icao: "ABC123", addedAt: "2026-03-02T00:00:00Z" },
              { id: 2, groupId: 7, icao: "DEF456", addedAt: "2026-03-02T00:00:00Z" },
            ],
          },
        ],
      });
    });

    render(<LayerPanel />);

    act(() => {
      fireEvent.click(screen.getByLabelText("Toggle layer panel"));
    });

    expect(screen.getByText("VIP")).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("checkbox", { name: "VIP 2" }));
    });

    expect(useWatchlistStore.getState().groups[0]?.visibleOnMap).toBe(false);
  });

  test("closes the panel on swipe-down when mobile sheet closing is enabled", () => {
    const onOpenChange = vi.fn();

    render(<LayerPanel enableSwipeClose={true} onOpenChange={onOpenChange} open={true} showTrigger={false} />);

    fireEvent.touchStart(screen.getByLabelText("Layer panel"), {
      touches: [{ clientX: 10, clientY: 20 }],
    });
    fireEvent.touchEnd(screen.getByLabelText("Layer panel"), {
      changedTouches: [{ clientX: 14, clientY: 130 }],
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
