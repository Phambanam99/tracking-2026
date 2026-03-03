import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { type ShipHistoryTrailWindow, useShipStore } from "../store/useShipStore";

const TRAIL_WINDOW_PRESETS: Array<{ label: string; value: ShipHistoryTrailWindow }> = [
  { label: "30m", value: 1_800_000 },
  { label: "2h", value: 7_200_000 },
  { label: "6h", value: 21_600_000 },
];

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

function formatDuration(start: number | null, end: number | null): string {
  if (start == null || end == null || end <= start) {
    return "-";
  }

  const totalMinutes = Math.round((end - start) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function ShipDetailPanel(): JSX.Element | null {
  const { locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const {
    detailMmsi,
    ship,
    detailMode,
    trailMmsi,
    trailPoints,
    trailRangeFrom,
    trailRangeTo,
    trailStatus,
    trailError,
    trailWindowMs,
    setTrailWindow,
    hideDetails,
  } = useShipStore(
    useShallow((state) => ({
      detailMmsi: state.detailMmsi,
      ship: state.detailMmsi ? state.ships[state.detailMmsi] : null,
      detailMode: state.detailMode,
      trailMmsi: state.trailMmsi,
      trailPoints: state.trailPoints,
      trailRangeFrom: state.trailRangeFrom,
      trailRangeTo: state.trailRangeTo,
      trailStatus: state.trailStatus,
      trailError: state.trailError,
      trailWindowMs: state.trailWindowMs,
      setTrailWindow: state.setTrailWindow,
      hideDetails: state.hideDetails,
    })),
  );

  if (!detailMmsi || !ship) {
    return null;
  }

  const contextLabel =
    detailMode === "history"
      ? t("ship.detail.context.history")
      : detailMode === "global"
        ? t("ship.detail.context.global")
        : detailMode === "viewport"
          ? t("ship.detail.context.viewport")
          : ship.isHistorical
            ? t("ship.detail.snapshotHistory")
            : t("ship.detail.snapshotLive");
  const showTrailPreview = (detailMode === "history" || detailMode === "global") && trailMmsi === detailMmsi;
  const trailSummary =
    trailPoints.length > 0
      ? `${trailPoints.length} ${t("ship.detail.trailPoints")} - ${formatDuration(trailRangeFrom, trailRangeTo)}`
      : null;

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
            : "h-full max-w-[24rem] animate-slide-in-right rounded-[28px]"
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
            <p className="text-[11px] uppercase tracking-[0.28em] text-teal-300/75">{t("ship.detail.title")}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">{ship.vesselName ?? ship.mmsi}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>{ship.mmsi}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  ship.isHistorical
                    ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                    : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                }`}
              >
                {ship.isHistorical ? t("ship.detail.badge.history") : t("ship.detail.badge.live")}
              </span>
              {ship.metadata?.isMilitary ? (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  {t("ship.military")}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-400">{contextLabel}</p>
          </div>
          <button
            aria-label={t("ship.detail.close")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={hideDetails}
            type="button"
          >
            {t("ship.detail.close")}
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5">
          {showTrailPreview ? (
            <div className="mb-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-200/80">
                {t("ship.detail.trailPreview")}
              </p>
              <div className="mt-2 flex gap-2">
                {TRAIL_WINDOW_PRESETS.map((preset) => (
                  <button
                    aria-label={t("ship.detail.trailWindowAria", { value: preset.label })}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                      trailWindowMs === preset.value
                        ? "border-indigo-200 bg-indigo-200/20 text-white"
                        : "border-indigo-300/30 text-indigo-100 hover:border-indigo-200/60 hover:text-white"
                    }`}
                    key={preset.value}
                    onClick={() => setTrailWindow(preset.value)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-100">
                {trailStatus === "loading"
                  ? t("ship.detail.trailLoading")
                  : trailStatus === "error"
                    ? trailError ?? t("ship.detail.trailError")
                    : trailPoints.length > 1
                      ? trailSummary
                      : t("ship.detail.trailEmpty")}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label={t("ship.field.mmsi")} value={ship.mmsi} />
            <Field label={t("ship.field.imo")} value={ship.imo} />
            <Field label={t("ship.field.callSign")} value={ship.callSign} />
            <Field label={t("ship.field.type")} value={ship.metadata?.shipTypeName ?? ship.vesselType} />
            <Field label={t("ship.field.navStatus")} value={ship.navStatus} />
            <Field label={t("ship.field.flag")} value={ship.metadata?.flagCountry} />
            <Field label={t("ship.field.speed")} value={ship.speed != null ? `${Math.round(ship.speed)} kts` : null} />
            <Field label={t("ship.field.course")} value={ship.course != null ? `${Math.round(ship.course)} deg` : null} />
            <Field label={t("ship.field.heading")} value={ship.heading != null ? `${Math.round(ship.heading)} deg` : null} />
            <Field label={t("ship.field.destination")} value={ship.destination} />
            <Field label={t("ship.field.latitude")} value={ship.lat.toFixed(6)} />
            <Field label={t("ship.field.longitude")} value={ship.lon.toFixed(6)} />
            <Field label={t("ship.field.eventTime")} value={formatEventTime(ship.eventTime, locale)} />
            <Field
              label={t("ship.detail.snapshotType")}
              value={ship.isHistorical ? t("ship.detail.snapshotHistory") : t("ship.detail.snapshotLive")}
            />
            <Field label={t("ship.field.source")} value={ship.sourceId} />
          </div>
        </div>
      </section>
    </aside>
  );
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
