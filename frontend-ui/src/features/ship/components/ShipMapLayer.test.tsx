import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useShipLayerStore } from "../store/useShipLayerStore";
import { useShipStore } from "../store/useShipStore";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

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

const addedFeatures: Array<{ getId: () => string | undefined }> = [];

vi.mock("ol/source/Vector", () => ({
  default: class MockVectorSource {
    private readonly features = new Map<string, { getId: () => string | undefined }>();

    public constructor(_: unknown) {}

    public getFeatures(): Array<{ getId: () => string | undefined }> {
      return Array.from(this.features.values());
    }

    public getFeatureById(id: string): { getId: () => string | undefined } | null {
      return this.features.get(id) ?? null;
    }

    public addFeature(feature: { getId: () => string | undefined }): void {
      const id = feature.getId();
      if (id) {
        this.features.set(id, feature);
      }
      addedFeatures.push(feature);
    }

    public removeFeature(feature: { getId: () => string | undefined }): void {
      const id = feature.getId();
      if (id) {
        this.features.delete(id);
      }
    }

    public clear(): void {
      this.features.clear();
    }
  },
}));

vi.mock("ol/layer/Vector", () => ({
  default: class MockVectorLayer {
    public visible = true;

    public constructor(_: unknown) {}

    public setVisible(nextVisible: boolean): void {
      this.visible = nextVisible;
    }
  },
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
    addedFeatures.length = 0;

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
    useShipLayerStore.setState({
      visible: {
        ships: true,
        labels: true,
        trail: true,
      },
      followSelected: false,
      trackedOnly: false,
      trackedGroupFilterIds: [],
    });
    useTrackedShipStore.setState({
      groups: [{ id: "default", name: "Default", color: "#f59e0b", mmsis: [], visibleOnMap: true }],
      activeGroupId: "default",
      trackedMmsis: {},
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

  test("hydrates existing ships into layer source on mount", () => {
    render(<ShipMapLayer />);

    expect(addedFeatures.some((feature) => feature.getId() === "574001230")).toBe(true);
  });

  test("filters tracked ship rendering by selected tracked group", () => {
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
          sourceId: "AIS",
          isHistorical: false,
          metadata: null,
          lastSeen: Date.now(),
        },
      },
    });
    useShipLayerStore.setState({
      visible: {
        ships: true,
        labels: true,
        trail: true,
      },
      followSelected: false,
      trackedOnly: true,
      trackedGroupFilterIds: ["ops"],
    });
    useTrackedShipStore.setState({
      groups: [
        { id: "default", name: "Default", color: "#f59e0b", mmsis: ["574001230"], visibleOnMap: true },
        { id: "ops", name: "Ops", color: "#22d3ee", mmsis: ["413387870"], visibleOnMap: true },
      ],
      activeGroupId: "default",
      trackedMmsis: { "574001230": true, "413387870": true },
    });

    render(<ShipMapLayer />);

    expect(addedFeatures.some((feature) => feature.getId() === "413387870")).toBe(true);
    expect(addedFeatures.some((feature) => feature.getId() === "574001230")).toBe(false);
  });
});
