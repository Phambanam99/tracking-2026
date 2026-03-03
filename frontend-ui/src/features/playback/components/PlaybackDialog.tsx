import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMapViewport } from "../../map/hooks/useMapViewport";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { fetchPlaybackFrames, toPlaybackFrames } from "../api/playbackApi";
import { usePlaybackStore } from "../store/usePlaybackStore";

const MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 200;

function toDateTimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function PlaybackDialog(): JSX.Element | null {
  const { t } = useI18n();
  const viewport = useMapViewport();
  const {
    isDialogOpen,
    status,
    timeFrom,
    timeTo,
    error,
    captureViewport,
    closeDialog,
    setTimeRange,
    setStatus,
    setFrames,
    setBatchInfo,
    showBar,
  } = usePlaybackStore(
    useShallow((state) => ({
      isDialogOpen: state.isDialogOpen,
      status: state.status,
      timeFrom: state.timeFrom,
      timeTo: state.timeTo,
      error: state.error,
      captureViewport: state.captureViewport,
      closeDialog: state.closeDialog,
      setTimeRange: state.setTimeRange,
      setStatus: state.setStatus,
      setFrames: state.setFrames,
      setBatchInfo: state.setBatchInfo,
      showBar: state.showBar,
    })),
  );
  const queryViewport = usePlaybackStore((state) => state.queryViewport);

  const rangeDurationHours = useMemo(() => {
    const from = new Date(timeFrom).getTime();
    const to = new Date(timeTo).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return 0;
    }
    return (to - from) / (60 * 60 * 1000);
  }, [timeFrom, timeTo]);

  async function handleStartPlayback(): Promise<void> {
    const currentViewport = queryViewport ?? viewport;
    if (!currentViewport) {
      setStatus("error", t("playback.noViewport"));
      return;
    }

    const from = new Date(timeFrom).getTime();
    const to = new Date(timeTo).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      setStatus("error", t("playback.invalidRange"));
      return;
    }

    if (to - from > MAX_LOOKBACK_MS) {
      setStatus("error", t("playback.maxRangeExceeded", { hours: 168 }));
      return;
    }

    captureViewport(currentViewport);
    setStatus("loading", null);

    try {
      const response = await fetchPlaybackFrames({
        timeFrom: from,
        timeTo: to,
        boundingBox: currentViewport,
        maxFrames: DEFAULT_BATCH_SIZE,
        cursor: null,
      });
      const nextFrames = toPlaybackFrames(response);
      setFrames(nextFrames);
      setBatchInfo({
        hasMore: response.hasMore,
        nextCursor: response.nextCursor,
        totalFrames: response.totalFrames,
      });

      if (nextFrames.length === 0) {
        setStatus("idle", t("playback.noData"));
        return;
      }

      showBar();
    } catch (requestError) {
      setStatus("error", requestError instanceof Error ? requestError.message : "Playback load failed");
    }
  }

  function handleNow(): void {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    setTimeRange(toDateTimeLocalValue(from), toDateTimeLocalValue(now));
  }

  if (!isDialogOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
      <section
        aria-label="Playback setup dialog"
        className="glass-panel-strong w-full max-w-md rounded-3xl border border-slate-700/80 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{t("playback.dialogTitle")}</h2>
            <p className="mt-1 text-xs text-slate-400">{t("playback.dialogDescription")}</p>
          </div>
          <button
            aria-label={t("playback.closeDialog")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 text-xs text-slate-300 hover:border-slate-500"
            onClick={closeDialog}
            type="button"
          >
            x
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          <label className="text-[11px] text-slate-300">
            {t("playback.from")}
            <input
              aria-label="Playback time from"
              className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              onChange={(event) => setTimeRange(event.target.value, timeTo)}
              type="datetime-local"
              value={timeFrom}
            />
          </label>
          <label className="text-[11px] text-slate-300">
            {t("playback.to")}
            <input
              aria-label="Playback time to"
              className="mt-1 min-h-11 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
              onChange={(event) => setTimeRange(timeFrom, event.target.value)}
              type="datetime-local"
              value={timeTo}
            />
          </label>
        </div>

        <div className="mt-3 text-[11px] text-slate-400">
          {t("playback.rangeHours", { hours: rangeDurationHours.toFixed(2) })}
        </div>

        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
            onClick={handleNow}
            type="button"
          >
            {t("playback.now")}
          </button>
          <button
            className="min-h-11 rounded border border-cyan-600 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
            disabled={status === "loading"}
            onClick={() => void handleStartPlayback()}
            type="button"
          >
            {status === "loading" ? t("playback.loading") : t("playback.startPlayback")}
          </button>
        </div>

        <p className="mt-2 text-right text-[11px] text-slate-400">{t("playback.dialogHint")}</p>
      </section>
    </div>
  );
}
