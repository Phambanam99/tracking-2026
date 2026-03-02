import { createContext, useContext } from "react";
import type OlMap from "ol/Map";

export type MapContextValue = {
  /** The OpenLayers Map instance, or null before the map has been initialised. */
  map: OlMap | null;
  /** The DOM element hosting the OpenLayers viewport. */
  mapContainerEl: HTMLDivElement | null;
};

export const MapContext = createContext<MapContextValue>({
  map: null,
  mapContainerEl: null,
});

/**
 * Returns the shared OpenLayers Map instance from the nearest MapContext.Provider.
 * Must be used inside a <MapContainer />.
 */
export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}
