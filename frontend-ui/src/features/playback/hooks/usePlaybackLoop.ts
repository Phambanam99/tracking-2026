import { useEffect } from "react";
import { usePlaybackStore } from "../store/usePlaybackStore";

const MIN_RENDER_FRAME_MS = 10;

export function usePlaybackLoop(): void {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const status = usePlaybackStore((state) => state.status);
  const frameCount = usePlaybackStore((state) => state.frameCount);
  const speedMultiplier = usePlaybackStore((state) => state.speedMultiplier);
  const frameIntervalMs = usePlaybackStore((state) => state.frameIntervalMs);

  useEffect(() => {
    if (!isPlaying || status !== "ready" || frameCount < 2) {
      return;
    }

    const stepIntervalMs = Math.max(
      MIN_RENDER_FRAME_MS,
      Math.round(frameIntervalMs / Math.max(speedMultiplier, 1)),
    );

    let frameHandle: number | null = null;
    let lastTimestamp: number | null = null;
    let accumulatedMs = 0;

    const tick = (timestamp: number): void => {
      const store = usePlaybackStore.getState();
      if (!store.isPlaying || store.status !== "ready") {
        return;
      }

      if (lastTimestamp == null) {
        lastTimestamp = timestamp;
      }

      accumulatedMs += timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      while (accumulatedMs >= stepIntervalMs) {
        const latestStore = usePlaybackStore.getState();
        if (latestStore.currentFrameIndex >= latestStore.frameCount - 1) {
          latestStore.pause();
          accumulatedMs = 0;
          break;
        }

        latestStore.stepForward();
        accumulatedMs -= stepIntervalMs;
      }

      frameHandle = window.requestAnimationFrame(tick);
    };

    frameHandle = window.requestAnimationFrame(tick);

    return () => {
      if (frameHandle != null) {
        window.cancelAnimationFrame(frameHandle);
      }
    };
  }, [frameCount, frameIntervalMs, isPlaying, speedMultiplier, status]);
}
