import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSearchStore } from "../store/useSearchStore";

const mockSearchHistory = vi.fn();

vi.mock("../api/searchApi", () => ({
  searchHistory: (...args: unknown[]) => mockSearchHistory(...args),
}));

import { AdvancedSearchForm } from "./AdvancedSearchForm";

describe("AdvancedSearchForm", () => {
  beforeEach(() => {
    useSearchStore.setState({
      filters: { query: "", mode: "history" },
      results: [],
      isSearching: false,
      error: null,
      selectedIcao: null,
    });
    mockSearchHistory.mockReset();
    mockSearchHistory.mockResolvedValue({ results: [], total: 0, truncated: false });
  });

  test("stores extended history filters and submits them to the API", async () => {
    render(<AdvancedSearchForm />);

    fireEvent.change(screen.getByLabelText("Registration"), { target: { value: "VN-A321" } });
    fireEvent.change(screen.getByLabelText("Speed min (kts)"), { target: { value: "320" } });
    fireEvent.change(screen.getByLabelText("Speed max (kts)"), { target: { value: "480" } });
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "RADARBOX-GLOBAL" } });
    fireEvent.change(screen.getByLabelText("North"), { target: { value: "21.1" } });
    fireEvent.change(screen.getByLabelText("South"), { target: { value: "20.9" } });
    fireEvent.change(screen.getByLabelText("East"), { target: { value: "105.9" } });
    fireEvent.change(screen.getByLabelText("West"), { target: { value: "105.7" } });
    fireEvent.click(screen.getByRole("button", { name: "Search History" }));

    await waitFor(() => {
      expect(mockSearchHistory).toHaveBeenCalledWith({
        query: "",
        icao: undefined,
        callsign: undefined,
        registration: "VN-A321",
        aircraftType: undefined,
        timeFrom: undefined,
        timeTo: undefined,
        altitudeMin: undefined,
        altitudeMax: undefined,
        speedMin: 320,
        speedMax: 480,
        sourceId: "RADARBOX-GLOBAL",
        boundingBox: {
          north: 21.1,
          south: 20.9,
          east: 105.9,
          west: 105.7,
        },
      });
    });
  });
});
