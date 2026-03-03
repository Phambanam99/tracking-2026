import { useMemo } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";

function formatTimelineTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

type PlaybackTimelineProps = {
  timeFromMs: number;
  timeToMs: number;
  currentTimeMs: number;
  zoomLevel: number;
  frameCount: number;
  currentFrameIndex: number;
  onFrameIndexChange: (index: number) => void;
};

export function PlaybackTimeline({
  timeFromMs,
  timeToMs,
  currentTimeMs,
  zoomLevel,
  frameCount,
  currentFrameIndex,
  onFrameIndexChange,
}: PlaybackTimelineProps): JSX.Element {
  const { t } = useI18n();

  const markers = useMemo(() => {
    if (!Number.isFinite(timeFromMs) || !Number.isFinite(timeToMs) || timeToMs <= timeFromMs) {
      return [] as Array<{ offsetPercent: number; label: string }>;
    }

    const totalDurationMs = timeToMs - timeFromMs;
    const visibleDurationMs = totalDurationMs / Math.max(zoomLevel, 0.5);
    const halfVisibleDurationMs = visibleDurationMs / 2;
    const center = Math.min(Math.max(currentTimeMs, timeFromMs), timeToMs);
    const visibleFrom = Math.max(timeFromMs, center - halfVisibleDurationMs);
    const visibleTo = Math.min(timeToMs, visibleFrom + visibleDurationMs);
    const actualVisibleDurationMs = Math.max(visibleTo - visibleFrom, 1);

    let stepMs = 30 * 60 * 1000;
    if (actualVisibleDurationMs <= 10 * 60 * 1000) {
      stepMs = 30 * 1000;
    } else if (actualVisibleDurationMs <= 30 * 60 * 1000) {
      stepMs = 60 * 1000;
    } else if (actualVisibleDurationMs <= 60 * 60 * 1000) {
      stepMs = 5 * 60 * 1000;
    } else if (actualVisibleDurationMs <= 2 * 60 * 60 * 1000) {
      stepMs = 15 * 60 * 1000;
    }

    const firstTick = Math.ceil(visibleFrom / stepMs) * stepMs;
    const result: Array<{ offsetPercent: number; label: string }> = [];

    for (let tick = firstTick; tick <= visibleTo; tick += stepMs) {
      const offsetPercent = ((tick - visibleFrom) / actualVisibleDurationMs) * 100;
      result.push({
        offsetPercent,
        label: formatTimelineTime(tick),
      });
    }

    return result;
  }, [currentTimeMs, timeFromMs, timeToMs, zoomLevel]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{t("playback.timeline")}</span>
        <span>{t("playback.frameCounter", { current: frameCount === 0 ? 0 : currentFrameIndex + 1, total: frameCount })}</span>
      </div>
      <input
        aria-label="Playback timeline"
        className="w-full accent-cyan-500"
        disabled={frameCount === 0}
        max={Math.max(frameCount - 1, 0)}
        min={0}
        onChange={(event) => onFrameIndexChange(Number(event.target.value))}
        step={1}
        type="range"
        value={Math.min(currentFrameIndex, Math.max(frameCount - 1, 0))}
      />
      <div className="relative h-4 overflow-hidden text-[10px] text-slate-400">
        {markers.map((marker) => (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            key={`${marker.label}-${marker.offsetPercent.toFixed(2)}`}
            style={{ left: `${marker.offsetPercent}%` }}
          >
            {marker.label}
          </span>
        ))}
      </div>
    </div>
  );
}
