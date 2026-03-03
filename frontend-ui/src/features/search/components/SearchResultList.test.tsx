import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useAircraftStore } from "../../aircraft/store/useAircraftStore";
import { useSearchStore } from "../store/useSearchStore";
import { SearchResultList } from "./SearchResultList";

const { mockAnimate, mockGetZoom } = vi.hoisted(() => ({
  mockAnimate: vi.fn(),
  mockGetZoom: vi.fn(() => 6),
}));

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({
    map: {
      getView: () => ({
        animate: mockAnimate,
        getZoom: mockGetZoom,
      }),
    },
  }),
}));

vi.mock("ol/proj", () => ({
  fromLonLat: vi.fn((coordinates: [number, number]) => coordinates),
}));

describe("SearchResultList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAircraftStore.setState({
      aircraft: {},
      selectedIcao: null,
      detailIcao: null,
      trailIcao: null,
      trailPositions: [],
    });
    useSearchStore.setState({
      filters: { query: "VN", mode: "viewport" },
      results: [],
      isSearching: false,
      error: null,
      selectedIcao: null,
    });
  });

  test("selects and zooms to a clicked search result", () => {
    render(
      <SearchResultList
        results={[
          {
            icao: "abc123",
            callsign: "VN123",
            lat: 10.5,
            lon: 106.7,
            eventTime: 1,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ABC123/i }));

    expect(useSearchStore.getState().selectedIcao).toBe("abc123");
    expect(useAircraftStore.getState().selectedIcao).toBe("abc123");
    expect(mockAnimate).toHaveBeenCalledWith({
      center: [106.7, 10.5],
      zoom: 9,
      duration: 350,
    });
  });

  test("renders empty state when no results are available", () => {
    render(<SearchResultList results={[]} />);

    expect(screen.getByText("No aircraft found. Try a different query.")).toBeInTheDocument();
  });
});

