/**
 * @deprecated BUG-7 FIX: This component is a legacy debug view that is NOT
 * mounted by App.tsx. The production map is rendered by MapContainer +
 * AircraftFeatureLayer. Do not add new features here; this file will be
 * removed in a future cleanup.
 *
 * Problems with this component:
 * - It manages its own viewport state (useState<BoundingBox>) disconnected
 *   from the real OpenLayers map extent.
 * - It runs a parallel useAnimationFrameRenderer loop at 30 fps.
 * - It renders a plain HTML list, not an OL map canvas.
 */

import { useFlightSocket } from "../hooks/useFlightSocket";
import { toFlightLayerData, type BoundingBox, type FlightLayerPoint } from "../render/flightLayer";
import { useAnimationFrameRenderer } from "../render/useAnimationFrameRenderer";
import { listFlights, upsertFlight } from "../store/useFlightRefStore";

const defaultViewport: BoundingBox = {
  // Wider SEA default so the live feed is visible on first load.
  north: 30.0,
  south: 0.0,
  east: 125.0,
  west: 90.0,
};

export function MapView(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [viewport, setViewport] = useState<BoundingBox>(defaultViewport);
  const [points, setPoints] = useState<FlightLayerPoint[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);

  const handlers = useMemo(
    () => ({
      onMessage: (message: { flight: { icao: string; lat: number; lon: number; heading?: number; speed?: number; altitude?: number } }) => {
        upsertFlight(message.flight);
      },
      onError: (error: string) => {
        setSocketError(error);
      },
    }),
    [],
  );

  useFlightSocket(accessToken, viewport, handlers);

  const renderFrame = useCallback(() => {
    const nextPoints = toFlightLayerData(listFlights(), viewport);
    setPoints(nextPoints);
  }, [viewport]);

  useAnimationFrameRenderer(renderFrame, 30);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">Live Flight Viewport</h3>
          <p className="text-sm text-slate-300">Realtime STOMP stream from gateway `/ws/live`</p>
        </div>
        <span className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-200">{points.length} flights</span>
      </header>

      <ViewportControls viewport={viewport} onChange={setViewport} />

      {socketError && <p className="rounded border border-rose-500/40 bg-rose-900/30 p-2 text-sm text-rose-200">{socketError}</p>}

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {points.map((point) => (
            <li className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm" key={point.id}>
              <p className="font-medium text-cyan-200">{point.id}</p>
              <p className="text-slate-300">
                lat: {point.lat.toFixed(4)} | lon: {point.lon.toFixed(4)}
              </p>
            </li>
          ))}
          {points.length === 0 && <li className="text-sm text-slate-400">No aircraft currently inside viewport.</li>}
        </ul>
      </div>
    </section>
  );
}

type ViewportControlsProps = {
  viewport: BoundingBox;
  onChange: (viewport: BoundingBox) => void;
};

function ViewportControls({ viewport, onChange }: ViewportControlsProps): JSX.Element {
  const update = (key: keyof BoundingBox, value: string): void => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return;
    }
    onChange({
      ...viewport,
      [key]: numeric,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-4">
      {(Object.keys(viewport) as Array<keyof BoundingBox>).map((key) => (
        <label className="text-xs text-slate-300" key={key}>
          {key}
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-ink"
            step="0.01"
            type="number"
            value={viewport[key]}
            onChange={(event) => update(key, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
