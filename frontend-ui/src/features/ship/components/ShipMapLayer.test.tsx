import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useShipStore } from "../store/useShipStore";

const {
  mockMap,
  mockMapOn,
  mockMapUn,
  mockForEachFeatureAtPixel,
  mockTargetElement,
} = vi.hoisted(() => {
  const targetElement = document.createElement("div");
  return {
    mockMapOn: vi.fn(),
    mockMapUn: vi.fn(),
    mockForEachFeatureAtPixel: vi.fn(),
    mockTargetElement: targetElement,
    mockMap: {
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
      forEachFeatureAtPixel: vi.fn(),
      getTargetElement: vi.fn(),
    },
  };
});

vi.mock("../../map/context/MapContext", () => ({
  useMapContext: () => ({ map: mockMap }),
}));

import { ShipMapLayer } from "./ShipMapLayer";

describe("ShipMapLayer", () => {
  beforeEach(() => {
    mockMap.on = mockMapOn;
    mockMap.un = mockMapUn;
    mockMap.forEachFeatureAtPixel = mockForEachFeatureAtPixel;
    mockMap.getTargetElement = vi.fn().mockReturnValue(mockTargetElement);
    mockMap.addLayer = vi.fn();
    mockMap.removeLayer = vi.fn();
    mockTargetElement.style.cursor = "";

    useShipStore.setState({
      ships: {
        "574001230": {
          mmsi: "574001230",
          lat: 10,
          lon: 106,
          speed: 12,
          course: 180,
          heading: 181,
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
      selectedMmsi: null,
      detailMmsi: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("selects ship on map click", async () => {
    const handlers = new Map<string, (event: { pixel: [number, number] }) => void>();
    mockMapOn.mockImplementation((eventName: string, handler: (event: { pixel: [number, number] }) => void) => {
      handlers.set(eventName, handler);
    });

    mockForEachFeatureAtPixel.mockReturnValue({
      get: (key: string) => (key === "mmsi" ? "574001230" : undefined),
    });

    render(<ShipMapLayer />);

    await act(async () => {
      handlers.get("click")?.({ pixel: [100, 120] });
      await Promise.resolve();
    });

    expect(useShipStore.getState().selectedMmsi).toBe("574001230");
  });
});
