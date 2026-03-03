import { useEffect } from "react";
import { fromLonLat } from "ol/proj";
import { useShallow } from "zustand/react/shallow";
import { useAircraftStore } from "../../aircraft/store/useAircraftStore";
import { useMapContext } from "../../map/context/MapContext";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { PlaybackSpeedSlider } from "./PlaybackSpeedSlider";
import { PlaybackTimeline } from "./PlaybackTimeline";
import { PlaybackZoomSlider } from "./PlaybackZoomSlider";
import { usePlaybackLoop } from "../hooks/usePlaybackLoop";
import { usePlaybackDataLoader } from "../hooks/usePlaybackDataLoader";
import {
  getCurrentPlaybackFrame,
  getPlaybackAircraftByIcao,
  usePlaybackStore,
} from "../store/usePlaybackStore";

const SPEED_PRESETS = [1, 5, 10, 25, 50, 100, 200, 300, 500, 1000];

function toMs(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveNextSpeedPreset(currentSpeed: number, direction: 1 | -1): number {
  const nearestIndex = SPEED_PRESETS.reduce((bestIndex, speed, index) => {
    const bestDistance = Math.abs(SPEED_PRESETS[bestIndex] - currentSpeed);
    const nextDistance = Math.abs(speed - currentSpeed);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);

  const candidateIndex = nearestIndex + direction;
  const clampedIndex = Math.max(0, Math.min(candidateIndex, SPEED_PRESETS.length - 1));
  return SPEED_PRESETS[clampedIndex];
}

export function PlaybackBar(): JSX.Element | null {
  const { t } = useI18n();
  const { map } = useMapContext();
  const selectedIcao = useAircraftStore((state) => state.selectedIcao);
  const {
    isBarVisible,
    status,
    frameCount,
    currentFrameIndex,
    speedMultiplier,
    timelineZoomLevel,
    timeFrom,
    timeTo,
    isPlaying,
    frameIntervalMs,
    hideBar,
    openDialog,
    setCurrentFrameIndex,
    setSpeedMultiplier,
    setTimelineZoomLevel,
    play,
    pause,
    stepBackward,
    stepForward,
    jumpToStart,
    jumpToEnd,
  } = usePlaybackStore(
    useShallow((state) => ({
      isBarVisible: state.isBarVisible,
      status: state.status,
      frameCount: state.frameCount,
      currentFrameIndex: state.currentFrameIndex,
      speedMultiplier: state.speedMultiplier,
      timelineZoomLevel: state.timelineZoomLevel,
      timeFrom: state.timeFrom,
      timeTo: state.timeTo,
      isPlaying: state.isPlaying,
      frameIntervalMs: state.frameIntervalMs,
      hideBar: state.hideBar,
      openDialog: state.openDialog,
      setCurrentFrameIndex: state.setCurrentFrameIndex,
      setSpeedMultiplier: state.setSpeedMultiplier,
      setTimelineZoomLevel: state.setTimelineZoomLevel,
      play: state.play,
      pause: state.pause,
      stepBackward: state.stepBackward,
      stepForward: state.stepForward,
      jumpToStart: state.jumpToStart,
      jumpToEnd: state.jumpToEnd,
    })),
  );
  const currentFrame = usePlaybackStore(getCurrentPlaybackFrame);
  const selectedPlaybackAircraft = usePlaybackStore((state) => getPlaybackAircraftByIcao(state, selectedIcao));

  usePlaybackLoop();
  usePlaybackDataLoader();

  useEffect(() => {
    if (!map) {
      return;
    }

    const view = map.getView?.();
    if (!view?.set) {
      return;
    }

    view.set("padding", isBarVisible ? [0, 0, 70, 0] : [0, 0, 0, 0]);

    return () => {
      view.set("padding", [0, 0, 0, 0]);
    };
  }, [isBarVisible, map]);

  useEffect(() => {
    if (!isBarVisible || status !== "ready") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable
          || target.tagName.toLowerCase() === "input"
          || target.tagName.toLowerCase() === "textarea"
          || target.tagName.toLowerCase() === "select")
      ) {
        return;
      }

      const skipFrames = Math.max(1, Math.round(30_000 / Math.max(frameIntervalMs, 1_000)));

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) {
          setCurrentFrameIndex(Math.max(currentFrameIndex - skipFrames, 0));
        } else {
          stepBackward();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) {
          setCurrentFrameIndex(Math.min(currentFrameIndex + skipFrames, Math.max(frameCount - 1, 0)));
        } else {
          stepForward();
        }
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        jumpToStart();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        jumpToEnd();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        hideBar();
        return;
      }

      if (event.ctrlKey) {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          setTimelineZoomLevel(Math.min(timelineZoomLevel + 0.5, 4));
          return;
        }
        if (event.key === "-" || event.key === "_") {
          event.preventDefault();
          setTimelineZoomLevel(Math.max(timelineZoomLevel - 0.5, 0.5));
          return;
        }
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setSpeedMultiplier(resolveNextSpeedPreset(speedMultiplier, 1));
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setSpeedMultiplier(resolveNextSpeedPreset(speedMultiplier, -1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentFrameIndex,
    frameCount,
    frameIntervalMs,
    hideBar,
    isBarVisible,
    isPlaying,
    jumpToEnd,
    jumpToStart,
    pause,
    play,
    setCurrentFrameIndex,
    setSpeedMultiplier,
    setTimelineZoomLevel,
    speedMultiplier,
    status,
    stepBackward,
    stepForward,
    timelineZoomLevel,
  ]);

  function handleClose(): void {
    hideBar();
  }

  function handleFocusSelected(): void {
    if (!map || !selectedPlaybackAircraft) {
      return;
    }

    const view = map.getView?.();
    if (!view) {
      return;
    }

    const nextZoom = Math.max(Number(view.getZoom?.() ?? 0), 8);
    view.animate?.({
      center: fromLonLat([selectedPlaybackAircraft.lon, selectedPlaybackAircraft.lat]),
      zoom: nextZoom,
      duration: 500,
    });
  }

  if (!isBarVisible || status !== "ready") {
    return null;
  }

  return (
    <section className="pointer-events-auto absolute inset-x-2 bottom-20 z-40 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 backdrop-blur md:bottom-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t("playback.title")}</h2>
        <div className="flex items-center gap-2">
          <button
            className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
            onClick={openDialog}
            type="button"
          >
            {t("playback.selectDate")}
          </button>
          <button
            aria-label={t("playback.close")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-slate-700 text-xs text-slate-300 hover:border-slate-500"
            onClick={handleClose}
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
        <PlaybackTimeline
          currentFrameIndex={currentFrameIndex}
          currentTimeMs={currentFrame?.timestamp ?? toMs(timeFrom)}
          frameCount={frameCount}
          onFrameIndexChange={setCurrentFrameIndex}
          timeFromMs={toMs(timeFrom)}
          timeToMs={toMs(timeTo)}
          zoomLevel={timelineZoomLevel}
        />

        <div className="grid grid-cols-1 gap-2 md:min-w-[320px]">
          <PlaybackSpeedSlider onChange={setSpeedMultiplier} value={speedMultiplier} />
          <PlaybackZoomSlider onChange={setTimelineZoomLevel} value={timelineZoomLevel} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200" onClick={jumpToStart} type="button">
          {t("playback.start")}
        </button>
        <button className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200" onClick={stepBackward} type="button">
          {t("playback.prev")}
        </button>
        <button
          className="min-h-11 rounded border border-cyan-600 px-3 py-2 text-xs text-cyan-100"
          onClick={() => (isPlaying ? pause() : play())}
          type="button"
        >
          {isPlaying ? t("playback.pause") : t("playback.play")}
        </button>
        <button className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200" onClick={stepForward} type="button">
          {t("playback.next")}
        </button>
        <button className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs text-slate-200" onClick={jumpToEnd} type="button">
          {t("playback.end")}
        </button>
        <button
          className="min-h-11 rounded border border-cyan-600 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50"
          disabled={!selectedPlaybackAircraft}
          onClick={handleFocusSelected}
          type="button"
        >
          {t("playback.focusSelected")}
        </button>
      </div>
    </section>
  );
}
