import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

const {
  mockMapOn,
  mockMapUn,
  mockGetPixelFromCoordinate,
} = vi.hoisted(() => ({
  mockMapOn: vi.fn(),
  mockMapUn: vi.fn(),
  mockGetPixelFromCoordinate: vi.fn().mockReturnValue([120, 80]),
}));

vi.mock("ol/proj", () => ({
  fromLonLat: vi.fn().mockImplementation((coordinates: number[]) => coordinates),
}));

const mockMapContainerEl = {
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    right: 400,
    bottom: 300,
    width: 400,
    height: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
} as HTMLDivElement;

const mockMap = {
  on: mockMapOn,
  un: mockMapUn,
  getPixelFromCoordinate: mockGetPixelFromCoordinate,
};

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({ map: mockMap, mapContainerEl: mockMapContainerEl }),
}));

import { ShipPopup } from "./ShipPopup";

describe("ShipPopup", () => {
  beforeEach(() => {
    act(() => {
      useShipStore.setState({ ships: {}, selectedMmsi: null, detailMmsi: null });
      useTrackedShipStore.setState({
        groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
        activeGroupId: "default",
        trackedMmsis: {},
      });
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      useShipStore.setState({ ships: {}, selectedMmsi: null, detailMmsi: null });
      useTrackedShipStore.setState({
        groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
        activeGroupId: "default",
        trackedMmsis: {},
      });
    });
  });

  test("renders selected ship details and opens detail panel", async () => {
    act(() => {
      useShipStore.setState({
        ships: {
          "574001230": {
            mmsi: "574001230",
            lat: 10,
            lon: 106,
            speed: 12,
            course: 180,
            heading: 181,
            navStatus: "under_way_using_engine",
            vesselName: "PACIFIC TRADER",
            vesselType: "cargo",
            imo: "9876543",
            callSign: "3WAB2",
            destination: "SG SIN",
            eta: null,
            eventTime: 100,
            sourceId: "AIS",
            upstreamSource: "hifleet",
            isHistorical: false,
            metadata: { flagCountry: "Vietnam", shipTypeName: "Cargo Vessel", isMilitary: false },
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: null,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipPopup />
      </I18nProvider>,
    );

    expect(screen.getByText("PACIFIC TRADER")).toBeDefined();
    expect(screen.getByText("SG SIN")).toBeDefined();
    expect(screen.getByText("MMSI")).toBeDefined();
    expect(screen.getByText("Type")).toBeDefined();
    expect(screen.getByText("Event time")).toBeDefined();
    expect(screen.getByText("Source")).toBeDefined();
    expect(screen.getByText("Upstream source")).toBeDefined();
    expect(screen.getByText("AIS")).toBeDefined();
    expect(screen.getByText("hifleet")).toBeDefined();
    expect(screen.getByRole("button", { name: "Track ship" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Track ship" }));
    expect(screen.getByLabelText("Select tracked ship group")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "View Details" }));
    expect(useShipStore.getState().detailMmsi).toBe("574001230");
  });

  test("close button clears selected ship", () => {
    act(() => {
      useShipStore.setState({
        ships: {
          "574001230": {
            mmsi: "574001230",
            lat: 10,
            lon: 106,
            speed: null,
            course: null,
            heading: null,
            navStatus: null,
            vesselName: "PACIFIC TRADER",
            vesselType: "cargo",
            imo: null,
            callSign: null,
            destination: null,
            eta: null,
            eventTime: 100,
            sourceId: "AIS",
            isHistorical: false,
            metadata: null,
            lastSeen: Date.now(),
          },
        },
        selectedMmsi: "574001230",
        detailMmsi: null,
      });
    });

    render(
      <I18nProvider defaultLanguage="en">
        <ShipPopup />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByLabelText("Close ship popup"));
    expect(useShipStore.getState().selectedMmsi).toBeNull();
  });
});
