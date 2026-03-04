import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

const mockAnimate = vi.fn();
const mockGetZoom = vi.fn().mockReturnValue(5);
const { searchShipGlobalMock } = vi.hoisted(() => ({
  searchShipGlobalMock: vi.fn(),
}));

vi.mock("ol/proj", () => ({
  fromLonLat: vi.fn().mockImplementation((coordinates: number[]) => coordinates),
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

vi.mock("../api/shipSearchApi", () => ({
  searchShipGlobal: searchShipGlobalMock,
}));

import { ShipTrackedPanel } from "./ShipTrackedPanel";

describe("ShipTrackedPanel", () => {
  beforeEach(() => {
    useShipStore.setState({
      ships: {
        "413387870": {
          mmsi: "413387870",
          lat: 19,
          lon: 108.6,
          speed: 9,
          course: 120,
          heading: 122,
          navStatus: null,
          vesselName: "FU TENG",
          vesselType: "cargo",
          imo: null,
          callSign: null,
          destination: null,
          eta: null,
          eventTime: 300,
          sourceId: "CHINAPORT-AIS",
          isHistorical: false,
          metadata: null,
          lastSeen: Date.now(),
        },
      },
      selectedMmsi: null,
      detailMmsi: null,
    });
    useTrackedShipStore.setState({
      groups: [
        {
          id: "default",
          name: "Default",
          color: "#f59e0b",
          mmsis: ["413387870"],
          visibleOnMap: true,
        },
        {
          id: "ops",
          name: "Ops",
          color: "#22d3ee",
          mmsis: [],
          visibleOnMap: true,
        },
      ],
      activeGroupId: "default",
      trackedMmsis: { "413387870": true },
    });
    searchShipGlobalMock.mockReset();
    mockAnimate.mockReset();
  });

  test("renders active group ships and supports focus/untrack", () => {
    render(
      <I18nProvider defaultLanguage="en">
        <ShipTrackedPanel onClose={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getAllByText("Default").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("FU TENG")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(useShipStore.getState().selectedMmsi).toBe("413387870");
    expect(mockAnimate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Untrack ship" }));
    expect(useTrackedShipStore.getState().groups.find((group) => group.id === "default")?.mmsis).toEqual([]);
  });

  test("creates, renames, and deletes groups from the group rail", () => {
    render(
      <I18nProvider defaultLanguage="en">
        <ShipTrackedPanel onClose={vi.fn()} />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "Priority" } });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect(screen.getAllByText("Priority").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]!);
    const renameInputs = screen.getAllByDisplayValue("Ops");
    fireEvent.change(renameInputs[0]!, { target: { value: "Operations" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]!);
    expect(screen.getAllByText("Operations").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
    expect(screen.queryByText("Operations")).not.toBeInTheDocument();
  });

  test("switches group and shows only ships of that group", () => {
    useTrackedShipStore.setState({
      groups: [
        { id: "default", name: "Default", color: "#f59e0b", mmsis: ["413387870"], visibleOnMap: true },
        { id: "ops", name: "Ops", color: "#22d3ee", mmsis: ["574001230"], visibleOnMap: true },
      ],
      activeGroupId: "default",
      trackedMmsis: { "413387870": true, "574001230": true },
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipTrackedPanel onClose={vi.fn()} />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Active group Ops" }));
    expect(screen.getAllByText("Awaiting live data").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("FU TENG")).not.toBeInTheDocument();
  });

  test("adds ship by raw MMSI to the active group", async () => {
    render(
      <I18nProvider defaultLanguage="en">
        <ShipTrackedPanel onClose={vi.fn()} />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText("Add ship by MMSI or search"), { target: { value: "574001230" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ship" }));

    await waitFor(() => {
      expect(useTrackedShipStore.getState().groups.find((group) => group.id === "default")?.mmsis).toContain("574001230");
    });
  });

  test("searches ships in panel and adds result to the active group", async () => {
    searchShipGlobalMock.mockResolvedValue({
      results: [
        {
          mmsi: "574001230",
          lat: 10,
          lon: 106,
          speed: 12,
          course: 180,
          heading: 181,
          eventTime: 1000,
          sourceId: "AIS",
          vesselName: "PACIFIC TRADER",
          vesselType: "cargo",
          imo: "9876543",
          callSign: "3WAB2",
          destination: "SG SIN",
          navStatus: null,
          isMilitary: false,
        },
      ],
      total: 1,
      truncated: false,
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipTrackedPanel onClose={vi.fn()} />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText("Add ship by MMSI or search"), { target: { value: "PACIFIC" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ship" }));

    expect(await screen.findByText("PACIFIC TRADER")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useTrackedShipStore.getState().groups.find((group) => group.id === "default")?.mmsis).toContain("574001230");
    });
    expect(useShipStore.getState().ships["574001230"]?.vesselName).toBe("PACIFIC TRADER");
  });
});
