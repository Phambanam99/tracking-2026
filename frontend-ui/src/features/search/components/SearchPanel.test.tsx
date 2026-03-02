import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useSearchStore } from "../store/useSearchStore";
import { SearchPanel } from "./SearchPanel";

// Prevent the hook from triggering debounced API calls in tests
vi.mock("../hooks/useSearchAircraft", () => ({
  useSearchAircraft: () => undefined,
  filterAircraftInViewport: vi.fn().mockReturnValue([]),
}));

describe("SearchPanel", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    useSearchStore.setState({
      filters: { query: "", mode: "viewport" },
      results: [],
      isSearching: false,
      error: null,
      selectedIcao: null,
    });
    vi.clearAllMocks();
  });

  test("renders panel header and close button", () => {
    render(<SearchPanel onClose={onClose} />);

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Close search")).toBeInTheDocument();
  });

  test("calls onClose when close button is clicked", () => {
    render(<SearchPanel onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close search"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("shows loading indicator when isSearching is true", () => {
    useSearchStore.setState({ isSearching: true });

    render(<SearchPanel onClose={onClose} />);

    expect(screen.getByText(/Searching/)).toBeInTheDocument();
  });

  test("shows error message when error is present", () => {
    useSearchStore.setState({ error: "Network error" });

    render(<SearchPanel onClose={onClose} />);

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  test("shows result count when query has results", () => {
    useSearchStore.setState({
      filters: { query: "ABC", mode: "viewport" },
      results: [
        { icao: "ABC123", lat: 21.0, lon: 105.0, eventTime: 0 },
        { icao: "ABC456", lat: 22.0, lon: 106.0, eventTime: 0 },
      ],
    });

    render(<SearchPanel onClose={onClose} />);

    expect(screen.getByText(/2 results/)).toBeInTheDocument();
  });

  test("shows no results message when query is active but empty", () => {
    useSearchStore.setState({
      filters: { query: "ZZZZZ", mode: "viewport" },
      results: [],
    });

    render(<SearchPanel onClose={onClose} />);

    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  test("does not show result count when query is too short", () => {
    useSearchStore.setState({
      filters: { query: "A", mode: "viewport" },
      results: [],
    });

    render(<SearchPanel onClose={onClose} />);

    expect(screen.queryByText("No results")).not.toBeInTheDocument();
  });
});
