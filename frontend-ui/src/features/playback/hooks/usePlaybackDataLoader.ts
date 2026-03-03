import { useEffect, useRef } from "react";
import { useMapViewport } from "../../map/hooks/useMapViewport";
import { usePlaybackStore } from "../store/usePlaybackStore";
import { fetchPlaybackFrames, toPlaybackFrames } from "../api/playbackApi";

const PREFETCH_THRESHOLD = 0.75;
const DEFAULT_BATCH_SIZE = 200;
const VIEWPORT_RELOAD_DEBOUNCE_MS = 300;

function areViewportsEquivalent(
  left: { north: number; south: number; east: number; west: number } | null,
  right: { north: number; south: number; east: number; west: number } | null,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  const epsilon = 1e-5;
  return (
    Math.abs(left.north - right.north) <= epsilon
    && Math.abs(left.south - right.south) <= epsilon
    && Math.abs(left.east - right.east) <= epsilon
    && Math.abs(left.west - right.west) <= epsilon
  );
}

export function usePlaybackDataLoader(): void {
  const viewport = useMapViewport();
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
  const pendingSeekTimeMs = usePlaybackStore((state) => state.pendingSeekTimeMs);
  const setFrames = usePlaybackStore((state) => state.setFrames);
  const appendFrames = usePlaybackStore((state) => state.appendFrames);
  const captureViewport = usePlaybackStore((state) => state.captureViewport);
  const setBatchInfo = usePlaybackStore((state) => state.setBatchInfo);
  const setPreFetching = usePlaybackStore((state) => state.setPreFetching);
  const clearSeekReload = usePlaybackStore((state) => state.clearSeekReload);
  const play = usePlaybackStore((state) => state.play);
  const setStatus = usePlaybackStore((state) => state.setStatus);
  const requestedCursorRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTimeRef = useRef(currentTime);
  const timeToRef = useRef(timeTo);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { timeToRef.current = timeTo; }, [timeTo]);

  async function reloadBuffer(input: {
    timeFromMs: number;
    timeToMs: number;
    viewportToUse: NonNullable<typeof queryViewport>;
  }): Promise<void> {
    const { timeFromMs, timeToMs, viewportToUse } = input;
    if (!Number.isFinite(timeFromMs) || !Number.isFinite(timeToMs) || timeToMs <= timeFromMs) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = ++requestSequenceRef.current;
    requestedCursorRef.current = null;
    setPreFetching(true);
    captureViewport(viewportToUse);

    // When the time range is large, the backend caps each scan window to
    // maxFrames buckets. If the first window has no data we must skip forward
    // until we find frames or exhaust the range.
    // Each window covers roughly DEFAULT_BATCH_SIZE × smallest-possible bucket (1 min).
    // We compute the max rounds needed to cover the full requested range, plus a
    // small safety margin so we never stop short.
    const MIN_BUCKET_MS_ESTIMATE = 60_000;
    const maxSkipRounds = Math.ceil((timeToMs - timeFromMs) / (DEFAULT_BATCH_SIZE * MIN_BUCKET_MS_ESTIMATE)) + 5;
    let cursor: string | null = null;

    try {
      for (let round = 0; round < maxSkipRounds; round += 1) {
        const response = await fetchPlaybackFrames({
          timeFrom: timeFromMs,
          timeTo: timeToMs,
          boundingBox: viewportToUse,
          maxFrames: DEFAULT_BATCH_SIZE,
          cursor,
        }, controller.signal);

        if (controller.signal.aborted || requestId !== requestSequenceRef.current) {
          return;
        }

        const nextFrames = toPlaybackFrames(response);

        if (nextFrames.length > 0 || !response.nextCursor) {
          // Found data, or exhausted the range — commit and stop.
          const wasPlaying = usePlaybackStore.getState().isPlaying;
          setFrames(nextFrames);
          setBatchInfo({
            hasMore: response.hasMore,
            nextCursor: response.nextCursor,
            totalFrames: response.totalFrames,
          });
          if (wasPlaying && nextFrames.length > 0) {
            play();
          }
          return;
        }

        // Empty window but more range exists — advance the cursor and retry.
        cursor = response.nextCursor;
      }

      // All skip rounds exhausted with no data found.
      setFrames([]);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      if (requestId !== requestSequenceRef.current) {
        return;
      }
      setPreFetching(false);
      setStatus("error", error instanceof Error ? error.message : "Playback reload failed");
    }
  }

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
    const requestId = ++requestSequenceRef.current;
    setPreFetching(true);

    void fetchPlaybackFrames({
      timeFrom: currentTimeMs,
      timeTo: timeToMs,
      boundingBox: queryViewport,
      maxFrames: DEFAULT_BATCH_SIZE,
      cursor: nextCursor,
    }, abortControllerRef.current?.signal)
      .then((response) => {
        if (requestId !== requestSequenceRef.current) {
          return;
        }
        appendFrames(toPlaybackFrames(response));
        setBatchInfo({
          hasMore: response.hasMore,
          nextCursor: response.nextCursor,
          totalFrames: response.totalFrames,
        });
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        if (requestId !== requestSequenceRef.current) {
          return;
        }
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

  useEffect(() => {
    if (!isBarVisible || status !== "ready" || !viewport || !queryViewport) {
      return;
    }

    if (areViewportsEquivalent(viewport, queryViewport)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const currentTimeMs = new Date(currentTimeRef.current).getTime();
      const timeToMs = new Date(timeToRef.current).getTime();

      void reloadBuffer({
        timeFromMs: currentTimeMs,
        timeToMs,
        viewportToUse: viewport,
      });
    }, VIEWPORT_RELOAD_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    isBarVisible,
    queryViewport,
    status,
    viewport,
  ]);

  useEffect(() => {
    if (!isBarVisible || status !== "ready" || pendingSeekTimeMs === null || !queryViewport) {
      return;
    }

    clearSeekReload();
    const timeToMs = new Date(timeTo).getTime();
    void reloadBuffer({
      timeFromMs: pendingSeekTimeMs,
      timeToMs,
      viewportToUse: queryViewport,
    });
  }, [
    clearSeekReload,
    isBarVisible,
    pendingSeekTimeMs,
    queryViewport,
    status,
    timeTo,
  ]);
}
