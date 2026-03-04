import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { getAllShipHistory } from "../api/shipSearchApi";
import { segmentShipVoyages, type ShipVoyage } from "../history/segmentShipVoyages";
import { useShipLayerStore } from "../store/useShipLayerStore";
import { useShipStore } from "../store/useShipStore";
import { ShipTrackGroupPicker } from "./ShipTrackGroupPicker";

type ShipDetailTab = "overview" | "history";
type ShipHistoryTabStatus = "idle" | "loading" | "ready" | "error";

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
    return `${totalMinutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatCoordinate(value: number, positiveSuffix: string, negativeSuffix: string): string {
  return `${Math.abs(value).toFixed(4)} ${value >= 0 ? positiveSuffix : negativeSuffix}`;
}

function toVoyagePoints(voyage: ShipVoyage): Array<{
  lat: number;
  lon: number;
  eventTime: number;
  speed: number | null;
  course: number | null;
  heading: number | null;
  sourceId: string;
}> {
  return voyage.points.map((point) => ({
    lat: point.lat,
    lon: point.lon,
    eventTime: point.eventTime,
    speed: point.speed ?? null,
    course: point.course ?? null,
    heading: point.heading ?? null,
    sourceId: point.sourceId,
  }));
}

export function ShipDetailPanel(): JSX.Element | null {
  const { locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const followSelected = useShipLayerStore((state) => state.followSelected);
  const setFollowSelected = useShipLayerStore((state) => state.setFollowSelected);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const historyLoadingMmsiRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<ShipDetailTab>("overview");
  const [historyStatus, setHistoryStatus] = useState<ShipHistoryTabStatus>("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVoyages, setHistoryVoyages] = useState<ShipVoyage[]>([]);
  const [loadedHistoryMmsi, setLoadedHistoryMmsi] = useState<string | null>(null);
  const { detailMmsi, ship, detailMode, activeTrailRouteKey, setActiveTrailRoute, setTrailReady, setTrailLoading, hideDetails } =
    useShipStore(
      useShallow((state) => ({
        detailMmsi: state.detailMmsi,
        ship: state.detailMmsi ? state.ships[state.detailMmsi] : null,
        detailMode: state.detailMode,
        activeTrailRouteKey: state.activeTrailRouteKey,
        setActiveTrailRoute: state.setActiveTrailRoute,
        setTrailReady: state.setTrailReady,
        setTrailLoading: state.setTrailLoading,
        hideDetails: state.hideDetails,
      })),
    );

  useEffect(() => {
    setActiveTab("overview");
    setHistoryStatus("idle");
    setHistoryError(null);
    setHistoryVoyages([]);
    setLoadedHistoryMmsi(null);
    historyLoadingMmsiRef.current = null;
  }, [detailMmsi]);

  useEffect(() => {
    if (activeTab !== "history" || !detailMmsi) {
      return;
    }
    if (loadedHistoryMmsi === detailMmsi || historyLoadingMmsiRef.current === detailMmsi) {
      return;
    }

    let cancelled = false;
    historyLoadingMmsiRef.current = detailMmsi;
    setHistoryStatus("loading");
    setHistoryError(null);

    getAllShipHistory(detailMmsi, {
      from: 0,
      to: Date.now(),
    })
      .then((points) => {
        if (cancelled) {
          return;
        }

        historyLoadingMmsiRef.current = null;
        setHistoryVoyages(segmentShipVoyages(points));
        setLoadedHistoryMmsi(detailMmsi);
        setHistoryStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        historyLoadingMmsiRef.current = null;
        setHistoryError(error instanceof Error ? error.message : "history-load-failed");
        setLoadedHistoryMmsi(detailMmsi);
        setHistoryStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, detailMmsi, loadedHistoryMmsi]);

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

  function handleOpenVoyage(voyage: ShipVoyage): void {
    setTrailLoading(voyage.key, voyage.mmsi, voyage.endPoint.eventTime, voyage.rangeFrom, voyage.rangeTo);
    setTrailReady(
      voyage.key,
      voyage.mmsi,
      voyage.endPoint.eventTime,
      toVoyagePoints(voyage),
      voyage.rangeFrom,
      voyage.rangeTo,
    );
    setActiveTrailRoute(voyage.key);
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

        <div className="border-b border-slate-800/70 px-5 py-3">
          <div className="flex gap-2">
            {(["overview", "history"] as const).map((tab) => (
              <button
                aria-pressed={activeTab === tab}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === tab
                    ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                    : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab === "overview" ? t("ship.detail.tab.overview") : t("ship.detail.tab.history")}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="mb-4 flex gap-2">
            <button
              aria-pressed={followSelected}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                followSelected
                  ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                  : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
              onClick={() => setFollowSelected(!followSelected)}
              type="button"
            >
              {followSelected ? t("ship.detail.following") : t("ship.detail.follow")}
            </button>
            <ShipTrackGroupPicker mmsi={ship.mmsi} />
          </div>

          {activeTab === "overview" ? (
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
              <Field label={t("ship.field.upstreamSource")} value={ship.upstreamSource} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                  {t("ship.detail.history.title")}
                </p>
                <p className="mt-2 text-sm text-slate-300">{t("ship.detail.history.description")}</p>
              </div>

              {historyStatus === "loading" ? (
                <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
                  {t("ship.detail.history.loading")}
                </div>
              ) : null}

              {historyStatus === "error" ? (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {historyError ?? t("ship.detail.history.error")}
                </div>
              ) : null}

              {historyStatus === "ready" && historyVoyages.length === 0 ? (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                  {t("ship.detail.history.empty")}
                </div>
              ) : null}

              {historyVoyages.map((voyage, index) => {
                const isActive = activeTrailRouteKey === voyage.key;

                return (
                  <article
                    className={`rounded-2xl border px-4 py-3 ${
                      isActive
                        ? "border-cyan-300/40 bg-cyan-300/10"
                        : "border-slate-800/80 bg-slate-950/40"
                    }`}
                    key={voyage.key}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
                          {t("ship.detail.history.voyage")} {historyVoyages.length - index}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-100">
                          {voyage.points.length} {t("ship.detail.trailPoints")} - {formatDuration(voyage.rangeFrom, voyage.rangeTo)}
                        </p>
                      </div>
                      <button
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                            : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                        }`}
                        onClick={() => handleOpenVoyage(voyage)}
                        type="button"
                      >
                        {t("ship.detail.history.showRoute")}
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <VoyageEndpoint
                        label={t("ship.detail.history.start")}
                        locale={locale}
                        point={voyage.startPoint}
                      />
                      <VoyageEndpoint
                        label={t("ship.detail.history.end")}
                        locale={locale}
                        point={voyage.endPoint}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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

function VoyageEndpoint({
  label,
  locale,
  point,
}: {
  label: string;
  locale: string;
  point: ShipVoyage["startPoint"];
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">
        {formatCoordinate(point.lat, "N", "S")} {formatCoordinate(point.lon, "E", "W")}
      </p>
      <p className="mt-1 text-xs text-slate-400">{formatEventTime(point.eventTime, locale)}</p>
    </div>
  );
}
