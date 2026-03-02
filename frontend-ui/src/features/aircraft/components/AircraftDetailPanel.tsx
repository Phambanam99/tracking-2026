import { useAircraftStore } from "../store/useAircraftStore";
import { useAircraftPhoto } from "../hooks/useAircraftPhoto";
import { useAircraftPhotoMetadata } from "../hooks/useAircraftPhotoMetadata";
import { getCountryName } from "../utils/countryDisplay";

function formatValue(value: number | string | null | undefined): string {
  if (value == null || value === "") {
    return "-";
  }
  return String(value);
}

function formatEventTime(timestamp: number | null | undefined): string {
  if (timestamp == null) {
    return "-";
  }
  return new Date(timestamp).toLocaleString();
}

function formatLastSeen(timestamp: number): string {
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const deltaSeconds = Math.round(deltaMs / 1000);
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const deltaMinutes = Math.round(deltaSeconds / 60);
  return `${deltaMinutes}m ago`;
}

function MilitaryBadge(): JSX.Element {
  return (
    <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
      Military
    </span>
  );
}

export function AircraftDetailPanel(): JSX.Element | null {
  const detailIcao = useAircraftStore((state) => state.detailIcao);
  const aircraft = useAircraftStore((state) =>
    detailIcao ? state.aircraft[detailIcao] : null,
  );
  const hideDetails = useAircraftStore((state) => state.hideDetails);
  const photo = useAircraftPhoto(detailIcao);
  const photoMetadata = useAircraftPhotoMetadata(detailIcao);
  const countryName = getCountryName(aircraft?.countryCode);

  if (!detailIcao || !aircraft) {
    return null;
  }

  return (
    <aside className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full justify-end p-3">
      <section className="pointer-events-auto flex h-full w-full max-w-sm flex-col rounded-xl border border-slate-700 bg-slate-950/95 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">
              {aircraft.callsign ?? aircraft.registration ?? aircraft.icao}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              {aircraft.countryFlagUrl ? (
                <img
                  alt={countryName ? `${countryName} flag` : "Country flag"}
                  className="h-4 w-6 rounded-sm object-cover"
                  src={aircraft.countryFlagUrl}
                />
              ) : null}
              <span>{aircraft.icao.toUpperCase()}</span>
              {aircraft.isMilitary ? <MilitaryBadge /> : null}
              {photoMetadata.metadata ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    photoMetadata.metadata.cacheHit
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {photoMetadata.metadata.cacheHit ? "Local cache hit" : "Cache warming"}
                </span>
              ) : null}
            </div>
          </div>
          <button
            aria-label="Close details"
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
            onClick={hideDetails}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="border-b border-slate-800 px-4 py-4">
          {photo.imageUrl ? (
            <img
              alt={`Aircraft ${aircraft.icao}`}
              className="h-44 w-full rounded-lg border border-slate-800 object-cover"
              src={photo.imageUrl}
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 text-sm text-slate-500">
              {photo.isLoading ? "Loading aircraft photo..." : "No aircraft photo"}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{photoMetadata.isLoading ? "Checking cache..." : `Photo source: ${photo.source ?? "none"}`}</span>
            {photoMetadata.metadata?.cachedAt ? (
              <span>Cached: {formatIsoDateTime(photoMetadata.metadata.cachedAt)}</span>
            ) : null}
            {photoMetadata.metadata?.localPhotoUrl ? (
              <a
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500 hover:text-white"
                href={photoMetadata.metadata.localPhotoUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open local photo
              </a>
            ) : null}
            {photoMetadata.metadata?.sourceUrl ? (
              <a
                className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500 hover:text-white"
                href={photoMetadata.metadata.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open source image
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 overflow-y-auto px-4 py-4 text-sm">
          <Field label="Registration" value={aircraft.registration} />
          <Field label="Type" value={aircraft.aircraftType} />
          <Field label="Class" value={aircraft.isMilitary ? "Military" : null} />
          <Field label="Operator" value={aircraft.operator} />
          <Field label="Country" value={countryName} />
          <Field label="Altitude" value={aircraft.altitude != null ? `${aircraft.altitude.toLocaleString()} ft` : null} />
          <Field label="Speed" value={aircraft.speed != null ? `${Math.round(aircraft.speed)} kts` : null} />
          <Field label="Heading" value={aircraft.heading != null ? `${Math.round(aircraft.heading)} deg` : null} />
          <Field label="Source" value={aircraft.sourceId} />
          <Field label="Latitude" value={aircraft.lat.toFixed(6)} />
          <Field label="Longitude" value={aircraft.lon.toFixed(6)} />
          <Field label="Event time" value={formatEventTime(aircraft.eventTime)} />
          <Field label="Last seen" value={formatLastSeen(aircraft.lastSeen)} />
        </div>
      </section>
    </aside>
  );
}

function formatIsoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

type FieldProps = {
  label: string;
  value: number | string | null | undefined;
};

function Field({ label, value }: FieldProps): JSX.Element {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{formatValue(value)}</p>
    </div>
  );
}
