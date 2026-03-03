import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { MapContext } from "../context/MapContext";
import { useOlMap, type UseOlMapOptions } from "../hooks/useOlMap";
import type { BaseLayerType } from "../layers/baseLayer";
import { MapStatusBar } from "./MapStatusBar";
import { MapToolbar, type MapToolbarProps } from "./MapToolbar";

export type MapContainerProps = UseOlMapOptions & {
  /** Optional forwarded toolbar props (e.g. tracked count from AircraftMapLayer). */
  toolbarProps?: MapToolbarProps;
  /** Additional content to render inside the MapContext (e.g. AircraftMapLayer). */
  children?: React.ReactNode;
  /** Hide the built-in top toolbar when using an external app shell. */
  showToolbar?: boolean;
  /** Hide the built-in status bar when using an external app shell. */
  showStatusBar?: boolean;
  /** Optional extra class names for the outer map shell container. */
  className?: string;
};

/**
 * MapContainer is the root map component.  
 * It creates an OpenLayers Map instance, mounts it onto a div, provides a
 * MapContext so child components can access the OL Map, and renders the toolbar
 * and status bar around the canvas.
 *
 * @example
 * ```tsx
 * <MapContainer>
 *   <AircraftMapLayer />
 * </MapContainer>
 * ```
 */
export function MapContainer({
  initialViewport,
  baseLayerType,
  toolbarProps,
  children,
  showToolbar = true,
  showStatusBar = true,
  className,
}: MapContainerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeBaseLayerType, setActiveBaseLayerType] = useState<BaseLayerType>(
    baseLayerType ?? "osm",
  );

  useEffect(() => {
    if (baseLayerType) {
      setActiveBaseLayerType(baseLayerType);
    }
  }, [baseLayerType]);

  const map = useOlMap(containerRef, { initialViewport, baseLayerType: activeBaseLayerType });

  return (
    <MapContext.Provider value={{ map, mapContainerEl: containerRef.current }}>
      {/* Outer wrapper fills all available height provided by the parent flex container */}
      <div
        className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden ${
          className ?? "rounded-lg border border-slate-700"
        }`}
      >
        {showToolbar ? (
          <MapToolbar
            {...(toolbarProps ?? {})}
            baseLayerType={activeBaseLayerType}
            onBaseLayerChange={setActiveBaseLayerType}
          />
        ) : null}

        {/* OL canvas target div – must have an explicit, non-zero height */}
        <div
          ref={containerRef}
          className="relative min-h-0 w-full flex-1"
          data-testid="ol-map-container"
        />

        {/* Child components (e.g. AircraftMapLayer, DrawingLayer) live inside MapContext */}
        {children}

        {showStatusBar ? <MapStatusBar /> : null}
      </div>
    </MapContext.Provider>
  );
}
