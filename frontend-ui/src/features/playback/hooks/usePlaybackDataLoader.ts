import { useEffect, useRef } from "react";
import { usePlaybackStore } from "../store/usePlaybackStore";
import { fetchPlaybackFrames, toPlaybackFrames } from "../api/playbackApi";

const PREFETCH_THRESHOLD = 0.75;
const DEFAULT_BATCH_SIZE = 200;

export function usePlaybackDataLoader(): void {
  const isBarVisible = usePlaybackStore((state) => state.isBarVisible);
  const status = usePlaybackStore((state) => state.status);
  const currentFrameIndex = usePlaybackStore((state) => state.currentFrameIndex);
  const frameCount = usePlaybackStore((state) => state.frameCount);
  const hasMore = usePlaybackStore((state) => state.hasMore);
  const nextCursor = usePlaybackStore((state) => state.nextCursor);
  const isPreFetching = usePlaybackStore((state) => state.isPreFetching);
  const queryViewport = usePlaybackStore((state) => state.queryViewport);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const timeTo = usePlaybackStore((state) => state.timeTo);
  const appendFrames = usePlaybackStore((state) => state.appendFrames);
  const setBatchInfo = usePlaybackStore((state) => state.setBatchInfo);
  const setPreFetching = usePlaybackStore((state) => state.setPreFetching);
  const setStatus = usePlaybackStore((state) => state.setStatus);
  const requestedCursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isBarVisible || status !== "ready") {
      requestedCursorRef.current = null;
      return;
    }

    if (!queryViewport || !hasMore || !nextCursor || isPreFetching || frameCount < 2) {
      return;
    }

    const progress = currentFrameIndex / Math.max(frameCount - 1, 1);
    if (progress < PREFETCH_THRESHOLD) {
      return;
    }

    if (requestedCursorRef.current === nextCursor) {
      return;
    }

    const currentTimeMs = new Date(currentTime).getTime();
    const timeToMs = new Date(timeTo).getTime();
    if (!Number.isFinite(timeToMs) || !Number.isFinite(currentTimeMs)) {
      return;
    }

    requestedCursorRef.current = nextCursor;
    setPreFetching(true);

    void fetchPlaybackFrames({
      timeFrom: currentTimeMs,
      timeTo: timeToMs,
      boundingBox: queryViewport,
      maxFrames: DEFAULT_BATCH_SIZE,
      cursor: nextCursor,
    })
      .then((response) => {
        appendFrames(toPlaybackFrames(response));
        setBatchInfo({
          hasMore: response.hasMore,
          nextCursor: response.nextCursor,
          totalFrames: response.totalFrames,
        });
      })
      .catch((error) => {
        setPreFetching(false);
        setStatus("error", error instanceof Error ? error.message : "Playback prefetch failed");
      });
  }, [
    appendFrames,
    currentFrameIndex,
    frameCount,
    hasMore,
    isBarVisible,
    isPreFetching,
    nextCursor,
    queryViewport,
    setBatchInfo,
    setPreFetching,
    setStatus,
    status,
    currentTime,
    timeTo,
  ]);
}
