import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getPlaybackAircraftByIcao,
  usePlaybackStore,
} from "../../playback/store/usePlaybackStore";
import { useAircraftStore } from "../store/useAircraftStore";
import { useAircraftDbBackfill } from "../hooks/useAircraftDbBackfill";
import { useAircraftPhoto } from "../hooks/useAircraftPhoto";
import { useAircraftPhotoMetadata } from "../hooks/useAircraftPhotoMetadata";
import { getCountryName } from "../utils/countryDisplay";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { useI18n } from "../../../shared/i18n/I18nProvider";

function formatValue(value: number | string | null | undefined): string {
  if (value == null || value === "") {
    return "-";
  }
  return String(value);
}

function formatEventTime(timestamp: number | null | undefined, locale: string): string {
  if (timestamp == null) {
    return "-";
  }
  return new Date(timestamp).toLocaleString(locale);
}

function formatLastSeen(timestamp: number, t: (key: string, values?: Record<string, string | number>) => string): string {
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const deltaSeconds = Math.round(deltaMs / 1000);
  if (deltaSeconds < 60) {
    return t("aircraft.detail.lastSeenSeconds", { count: deltaSeconds });
  }
  const deltaMinutes = Math.round(deltaSeconds / 60);
  return t("aircraft.detail.lastSeenMinutes", { count: deltaMinutes });
}

function MilitaryBadge({ label }: { label: string }): JSX.Element {
  return (
    <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
      {label}
    </span>
  );
}

export function AircraftDetailPanel(): JSX.Element | null {
  const { locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const { detailIcao, liveAircraft, hideDetails } = useAircraftStore(
    useShallow((state) => ({
      detailIcao: state.detailIcao,
      liveAircraft: state.detailIcao ? state.aircraft[state.detailIcao] : null,
      hideDetails: state.hideDetails,
    })),
  );
  const { playbackIsOpen, playbackStatus } = usePlaybackStore(
    useShallow((state) => ({
      playbackIsOpen: state.isOpen,
      playbackStatus: state.status,
    })),
  );
  const playbackAircraft = usePlaybackStore((state) => getPlaybackAircraftByIcao(state, detailIcao));
  const aircraft =
    playbackIsOpen && playbackStatus === "ready"
      ? playbackAircraft
      : liveAircraft;
  useAircraftDbBackfill(detailIcao);
  const photo = useAircraftPhoto(detailIcao);
  const photoMetadata = useAircraftPhotoMetadata(detailIcao);
  const countryName = getCountryName(aircraft?.countryCode);

  if (!detailIcao || !aircraft) {
    return null;
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>): void {
    if (!isMobile) {
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>): void {
    if (!isMobile) {
      return;
    }

    const startY = touchStartYRef.current;
    const startX = touchStartXRef.current;
    const endY = event.changedTouches[0]?.clientY ?? null;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartYRef.current = null;
    touchStartXRef.current = null;

    if (startY == null || startX == null || endY == null || endX == null) {
      return;
    }

    const deltaY = endY - startY;
    const deltaX = Math.abs(endX - startX);
    if (deltaY > 72 && deltaY > deltaX) {
      hideDetails();
    }
  }

  return (
    <aside
      className={`pointer-events-none absolute z-30 flex w-full ${
        isMobile ? "bottom-20 left-0 right-0 justify-center px-3" : "bottom-4 right-4 top-20 justify-end"
      }`}
    >
      <section
        className={`glass-panel-strong pointer-events-auto flex w-full flex-col ${
          isMobile
            ? "max-h-[min(62vh,34rem)] max-w-none animate-slide-in-up rounded-[24px]"
            : "h-full max-w-[26rem] animate-slide-in-right rounded-[28px]"
        }`}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
      >
        {isMobile ? (
          <div className="flex shrink-0 justify-center pt-2">
            <span className="h-1.5 w-14 rounded-full bg-slate-600/80" />
          </div>
        ) : null}
        <header className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/75">{t("aircraft.detail.title")}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">
              {aircraft.callsign ?? aircraft.registration ?? aircraft.icao}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              {aircraft.countryFlagUrl ? (
                <img
                  alt={countryName ? `${countryName} flag` : t("aircraft.detail.countryFlag")}
                  className="h-4 w-6 rounded-sm object-cover"
                  src={aircraft.countryFlagUrl}
                />
              ) : null}
              <span>{aircraft.icao.toUpperCase()}</span>
              {aircraft.isMilitary ? <MilitaryBadge label={t("aircraft.military")} /> : null}
              {photoMetadata.metadata ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    photoMetadata.metadata.cacheHit
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {photoMetadata.metadata.cacheHit ? t("aircraft.detail.localCacheHit") : t("aircraft.detail.cacheWarming")}
                </span>
              ) : null}
            </div>
          </div>
          <button
            aria-label={t("aircraft.detail.close")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={hideDetails}
            type="button"
          >
            {t("aircraft.detail.close")}
          </button>
        </header>

        <div className="border-b border-slate-800/80 px-5 py-4">
          {photo.imageUrl ? (
            <img
              alt={`Aircraft ${aircraft.icao}`}
              className="h-48 w-full rounded-2xl border border-slate-800/80 object-cover"
              src={photo.imageUrl}
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 text-sm text-slate-500">
              {photo.isLoading ? t("aircraft.detail.loadingPhoto") : t("aircraft.detail.noPhoto")}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              {photoMetadata.isLoading
                ? t("aircraft.detail.checkingCache")
                : t("aircraft.detail.photoSource", { source: photo.source ?? t("aircraft.detail.none") })}
            </span>
            {photoMetadata.metadata?.cachedAt ? (
              <span>{t("aircraft.detail.cachedAt", { value: formatIsoDateTime(photoMetadata.metadata.cachedAt, locale) })}</span>
            ) : null}
            {photoMetadata.metadata?.localPhotoUrl ? (
              <a
                className="inline-flex min-h-11 items-center rounded border border-slate-700 px-3 py-2 text-slate-300 hover:border-slate-500 hover:text-white"
                href={photoMetadata.metadata.localPhotoUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t("aircraft.detail.openLocalPhoto")}
              </a>
            ) : null}
            {photoMetadata.metadata?.sourceUrl ? (
              <a
                className="inline-flex min-h-11 items-center rounded border border-slate-700 px-3 py-2 text-slate-300 hover:border-slate-500 hover:text-white"
                href={photoMetadata.metadata.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t("aircraft.detail.openSourceImage")}
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 overflow-y-auto px-5 py-5 text-sm">
          <Field label={t("aircraft.field.registration")} value={aircraft.registration} />
          <Field label={t("aircraft.field.type")} value={aircraft.aircraftType} />
          <Field label={t("aircraft.field.class")} value={aircraft.isMilitary ? t("aircraft.military") : null} />
          <Field label={t("aircraft.field.operator")} value={aircraft.operator} />
          <Field label={t("aircraft.field.country")} value={countryName} />
          <Field label={t("aircraft.field.altitude")} value={aircraft.altitude != null ? `${aircraft.altitude.toLocaleString()} ft` : null} />
          <Field label={t("aircraft.field.speed")} value={aircraft.speed != null ? `${Math.round(aircraft.speed)} kts` : null} />
          <Field label={t("aircraft.field.heading")} value={aircraft.heading != null ? `${Math.round(aircraft.heading)} deg` : null} />
          <Field label={t("aircraft.field.source")} value={aircraft.sourceId} />
          <Field label={t("aircraft.field.latitude")} value={aircraft.lat.toFixed(6)} />
          <Field label={t("aircraft.field.longitude")} value={aircraft.lon.toFixed(6)} />
          <Field label={t("aircraft.field.eventTime")} value={formatEventTime(aircraft.eventTime, locale)} />
          <Field label={t("aircraft.field.lastSeen")} value={formatLastSeen(aircraft.lastSeen, t)} />
        </div>
      </section>
    </aside>
  );
}

function formatIsoDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale);
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
