import { create } from "zustand";
import type { LonLatExtent } from "../../map/types/mapTypes";
import type { Aircraft } from "../../aircraft/types/aircraftTypes";
import type { PlaybackFrame, PlaybackState, PlaybackStatus } from "../types/playbackTypes";

const DEFAULT_SPEED_MULTIPLIER = 300;
const MIN_SPEED_MULTIPLIER = 1;
const MAX_SPEED_MULTIPLIER = 1000;
const DEFAULT_FRAME_INTERVAL_MS = 15_000;
const MIN_TIMELINE_ZOOM = 0.5;
const MAX_TIMELINE_ZOOM = 4;
const DEFAULT_TIMELINE_ZOOM = 1;

function toDateTimeLocalValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function createDefaultWindow(): Pick<PlaybackState, "timeFrom" | "timeTo" | "currentTime"> {
  const timeTo = new Date();
  const timeFrom = new Date(timeTo.getTime() - 60 * 60 * 1000);
  return {
    timeFrom: toDateTimeLocalValue(timeFrom),
    timeTo: toDateTimeLocalValue(timeTo),
    currentTime: toDateTimeLocalValue(timeFrom),
  };
}

function clampSpeedMultiplier(speedMultiplier: number): number {
  return Math.max(
    MIN_SPEED_MULTIPLIER,
    Math.min(MAX_SPEED_MULTIPLIER, Math.round(speedMultiplier)),
  );
}

function clampTimelineZoom(zoomLevel: number): number {
  return Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, zoomLevel));
}

function resolveFrameTime(frames: PlaybackFrame[], index: number, fallback: string): string {
  const frame = frames[Math.max(0, Math.min(index, frames.length - 1))];
  return frame ? toDateTimeLocalValue(new Date(frame.timestamp)) : fallback;
}

export function getPlaybackFrameAtIndex(
  frames: PlaybackFrame[],
  index: number,
): PlaybackFrame | null {
  if (frames.length === 0) {
    return null;
  }

  return frames[Math.max(0, Math.min(index, frames.length - 1))] ?? null;
}

export function getCurrentPlaybackFrame(state: PlaybackState): PlaybackFrame | null {
  return getPlaybackFrameAtIndex(state.frames, state.currentFrameIndex);
}

export function getPlaybackAircraftByIcao(
  state: PlaybackState,
  icao: string | null,
): Aircraft | null {
  if (!icao) {
    return null;
  }

  const currentFrame = getCurrentPlaybackFrame(state);
  return currentFrame?.aircraft.find((aircraft) => aircraft.icao === icao) ?? null;
}

function findNearestFrameIndex(frames: PlaybackFrame[], currentTime: string): number {
  if (frames.length === 0) {
    return 0;
  }

  const target = new Date(currentTime).getTime();
  let nearestIndex = 0;
  let nearestDistance = Math.abs(frames[0].timestamp - target);

  for (let index = 1; index < frames.length; index += 1) {
    const distance = Math.abs(frames[index].timestamp - target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

function resolveFrameIntervalMs(frames: PlaybackFrame[]): number {
  if (frames.length < 2) {
    return DEFAULT_FRAME_INTERVAL_MS;
  }

  const rawInterval = Math.abs(frames[1].timestamp - frames[0].timestamp);
  return Math.max(1_000, rawInterval || DEFAULT_FRAME_INTERVAL_MS);
}

type PlaybackActions = {
  open: () => void;
  toggleOpen: () => void;
  close: () => void;
  openDialog: () => void;
  closeDialog: () => void;
  showBar: () => void;
  hideBar: () => void;
  captureViewport: (viewport: LonLatExtent | null) => void;
  setFreezeViewport: (freezeViewport: boolean) => void;
  setTimeRange: (timeFrom: string, timeTo: string) => void;
  setCurrentTime: (currentTime: string) => void;
  setCurrentFrameIndex: (index: number) => void;
  setSpeedMs: (speedMs: number) => void;
  setSpeedMultiplier: (speedMultiplier: number) => void;
  setTimelineZoomLevel: (zoomLevel: number) => void;
  play: () => void;
  pause: () => void;
  setStatus: (status: PlaybackStatus, error?: string | null) => void;
  setFrames: (frames: PlaybackFrame[]) => void;
  appendFrames: (frames: PlaybackFrame[]) => void;
  setBatchInfo: (input: { hasMore: boolean; nextCursor: string | null; totalFrames?: number }) => void;
  setPreFetching: (isPreFetching: boolean) => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
};

export type PlaybackStore = PlaybackState & PlaybackActions;

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  isDialogOpen: false,
  isBarVisible: false,
  isOpen: false,
  mode: "viewport",
  queryViewport: null,
  freezeViewport: true,
  ...createDefaultWindow(),
  currentFrameIndex: 0,
  speedMs: Math.round(DEFAULT_FRAME_INTERVAL_MS / DEFAULT_SPEED_MULTIPLIER),
  speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
  timelineZoomLevel: DEFAULT_TIMELINE_ZOOM,
  frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
  isPlaying: false,
  status: "idle",
  error: null,
  frames: [],
  frameCount: 0,
  totalFrames: 0,
  hasMore: false,
  nextCursor: null,
  isPreFetching: false,

  open: () =>
    set({
      isDialogOpen: true,
      isOpen: true,
    }),

  toggleOpen: () =>
    set((state) => ({
      isDialogOpen: !state.isOpen,
      isBarVisible: false,
      isOpen: !state.isOpen,
      isPlaying: false,
    })),

  close: () =>
    set({
      isDialogOpen: false,
      isBarVisible: false,
      isOpen: false,
      isPlaying: false,
    }),

  openDialog: () =>
    set({
      isDialogOpen: true,
      isOpen: true,
    }),

  closeDialog: () =>
    set((state) => ({
      isDialogOpen: false,
      isOpen: state.isBarVisible,
    })),

  showBar: () =>
    set({
      isDialogOpen: false,
      isBarVisible: true,
      isOpen: true,
    }),

  hideBar: () =>
    set({
      isDialogOpen: false,
      isBarVisible: false,
      isOpen: false,
      isPlaying: false,
    }),

  captureViewport: (queryViewport) =>
    set({
      queryViewport,
    }),

  setFreezeViewport: (freezeViewport) =>
    set({
      freezeViewport,
    }),

  setTimeRange: (timeFrom, timeTo) =>
    set((state) => {
      const nextCurrentTime =
        state.currentTime < timeFrom || state.currentTime > timeTo ? timeFrom : state.currentTime;
      const nextFrameIndex = findNearestFrameIndex(state.frames, nextCurrentTime);
      return {
        timeFrom,
        timeTo,
        currentTime: resolveFrameTime(state.frames, nextFrameIndex, nextCurrentTime),
        currentFrameIndex: nextFrameIndex,
      };
    }),

  setCurrentTime: (currentTime) =>
    set((state) => {
      const currentFrameIndex = findNearestFrameIndex(state.frames, currentTime);
      return {
        currentTime: resolveFrameTime(state.frames, currentFrameIndex, currentTime),
        currentFrameIndex,
        isPlaying: false,
      };
    }),

  setCurrentFrameIndex: (index) =>
    set((state) => {
      if (state.frames.length === 0) {
        return {
          currentFrameIndex: 0,
          isPlaying: false,
        };
      }

      const currentFrameIndex = Math.max(0, Math.min(index, state.frames.length - 1));
      return {
        currentFrameIndex,
        currentTime: resolveFrameTime(state.frames, currentFrameIndex, state.currentTime),
        isPlaying: false,
      };
    }),

  setSpeedMs: (speedMs) =>
    set((state) => {
      const boundedSpeedMs = Math.max(10, Math.round(speedMs));
      const speedMultiplier = clampSpeedMultiplier(
        Math.round(state.frameIntervalMs / Math.max(boundedSpeedMs, 1)),
      );
      return {
        speedMs: boundedSpeedMs,
        speedMultiplier,
      };
    }),

  setSpeedMultiplier: (speedMultiplier) =>
    set((state) => {
      const nextSpeedMultiplier = clampSpeedMultiplier(speedMultiplier);
      return {
        speedMultiplier: nextSpeedMultiplier,
        speedMs: Math.max(10, Math.round(state.frameIntervalMs / nextSpeedMultiplier)),
      };
    }),

  setTimelineZoomLevel: (zoomLevel) =>
    set({
      timelineZoomLevel: clampTimelineZoom(zoomLevel),
    }),

  play: () =>
    set({
      isPlaying: true,
    }),

  pause: () =>
    set({
      isPlaying: false,
    }),

  setStatus: (status, error = null) =>
    set((state) => ({
      status,
      error,
      isPlaying: status === "ready" ? state.isPlaying : false,
    })),

  setFrames: (frames) =>
    set((state) => {
      const nextFrameIndex = findNearestFrameIndex(frames, state.currentTime);
      const frameIntervalMs = resolveFrameIntervalMs(frames);
      return {
        frames,
        frameCount: frames.length,
        totalFrames: frames.length,
        hasMore: false,
        nextCursor: null,
        isPreFetching: false,
        currentFrameIndex: frames.length === 0 ? 0 : nextFrameIndex,
        currentTime: resolveFrameTime(frames, nextFrameIndex, state.currentTime),
        status: frames.length > 0 ? "ready" : "idle",
        error: null,
        isPlaying: false,
        frameIntervalMs,
        speedMs: Math.max(10, Math.round(frameIntervalMs / Math.max(state.speedMultiplier, 1))),
      };
    }),

  appendFrames: (frames) =>
    set((state) => {
      if (frames.length === 0) {
        return {
          isPreFetching: false,
        };
      }

      const existingTimestamps = new Set(state.frames.map((item) => item.timestamp));
      const nextFrames = [
        ...state.frames,
        ...frames.filter((item) => !existingTimestamps.has(item.timestamp)),
      ].sort((left, right) => left.timestamp - right.timestamp);
      const frameIntervalMs = resolveFrameIntervalMs(nextFrames);

      return {
        frames: nextFrames,
        frameCount: nextFrames.length,
        totalFrames: Math.max(state.totalFrames, nextFrames.length),
        frameIntervalMs,
        speedMs: Math.max(10, Math.round(frameIntervalMs / Math.max(state.speedMultiplier, 1))),
        isPreFetching: false,
      };
    }),

  setBatchInfo: ({ hasMore, nextCursor, totalFrames }) =>
    set((state) => ({
      hasMore,
      nextCursor,
      totalFrames: Math.max(totalFrames ?? 0, state.totalFrames, state.frameCount),
    })),

  setPreFetching: (isPreFetching) =>
    set({
      isPreFetching,
    }),

  stepForward: () =>
    set((state) => {
      if (state.frames.length === 0) {
        return {};
      }

      const currentIndex = Math.max(0, Math.min(state.currentFrameIndex, state.frames.length - 1));
      const nextIndex = Math.min(currentIndex + 1, state.frames.length - 1);
      return {
        currentFrameIndex: nextIndex,
        currentTime: resolveFrameTime(state.frames, nextIndex, state.currentTime),
        isPlaying: currentIndex < state.frames.length - 1,
      };
    }),

  stepBackward: () =>
    set((state) => {
      if (state.frames.length === 0) {
        return {};
      }

      const currentIndex = Math.max(0, Math.min(state.currentFrameIndex, state.frames.length - 1));
      const nextIndex = Math.max(currentIndex - 1, 0);
      return {
        currentFrameIndex: nextIndex,
        currentTime: resolveFrameTime(state.frames, nextIndex, state.currentTime),
        isPlaying: false,
      };
    }),

  jumpToStart: () =>
    set((state) => ({
      currentFrameIndex: 0,
      currentTime: resolveFrameTime(state.frames, 0, state.timeFrom),
      isPlaying: false,
    })),

  jumpToEnd: () =>
    set((state) => {
      const lastIndex = Math.max(state.frames.length - 1, 0);
      return {
        currentFrameIndex: lastIndex,
        currentTime: resolveFrameTime(state.frames, lastIndex, state.timeTo),
        isPlaying: false,
      };
    }),
}));
