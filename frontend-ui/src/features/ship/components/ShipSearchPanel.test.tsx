import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { useShipStore } from "../store/useShipStore";

const mockAnimate = vi.fn();
const mockGetZoom = vi.fn().mockReturnValue(5);

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

import { ShipSearchPanel } from "./ShipSearchPanel";

describe("ShipSearchPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("filters ships in memory and selects the clicked ship", () => {
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
            imo: "9876543",
            callSign: "3WAB2",
            destination: "SG SIN",
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

    render(
      <I18nProvider defaultLanguage="en">
        <ShipSearchPanel onClose={vi.fn()} />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText("Search ships"), { target: { value: "pac" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const resultButton = screen.getByText("574001230").closest("button");
    expect(resultButton).not.toBeNull();
    fireEvent.click(resultButton as HTMLButtonElement);

    expect(useShipStore.getState().selectedMmsi).toBe("574001230");
    expect(mockAnimate).toHaveBeenCalledTimes(1);
  });
});
