import { useEffect, useRef } from "react";
import type { BoundingBox } from "../../map/render/flightLayer";
import { fetchLiveShipsInViewport } from "../api/shipSearchApi";
import { useShipStore } from "../store/useShipStore";

const VIEWPORT_SNAPSHOT_DEBOUNCE_MS = 350;

export function useShipViewportSnapshot(
  token: string | null,
  viewport: BoundingBox,
  enabled = true,
): void {
  const upsertShipBatch = useShipStore((state) => state.upsertShipBatch);
  const requestIdRef = useRef(0);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (!token || !enabled) {
      firstLoadRef.current = true;
      return;
    }

    const requestId = ++requestIdRef.current;
    const delay = firstLoadRef.current ? 0 : VIEWPORT_SNAPSHOT_DEBOUNCE_MS;

    const timeoutId = window.setTimeout(() => {
      void fetchLiveShipsInViewport(viewport)
        .then((ships) => {
          if (requestId !== requestIdRef.current || ships.length === 0) {
            return;
          }
          upsertShipBatch(ships);
        })
        .catch((error) => {
          console.warn("[ShipViewportSnapshot]", error);
        });
    }, delay);

    firstLoadRef.current = false;

    return () => window.clearTimeout(timeoutId);
  }, [
    enabled,
    token,
    upsertShipBatch,
    viewport.east,
    viewport.north,
    viewport.south,
    viewport.west,
  ]);
}
