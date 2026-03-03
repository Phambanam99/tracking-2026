import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LonLatExtent } from "../../map/types/mapTypes";
import { usePlaybackStore } from "../store/usePlaybackStore";

const {
  mockFetchPlaybackFrames,
  mockToPlaybackFrames,
  viewportState,
} = vi.hoisted(() => ({
  mockFetchPlaybackFrames: vi.fn(),
  mockToPlaybackFrames: vi.fn(),
  viewportState: {
    value: null as LonLatExtent | null,
  },
}));

vi.mock("../../map/hooks/useMapViewport", () => ({
  useMapViewport: () => viewportState.value,
}));

vi.mock("../api/playbackApi", () => ({
  fetchPlaybackFrames: mockFetchPlaybackFrames,
  toPlaybackFrames: mockToPlaybackFrames,
}));

import { usePlaybackDataLoader } from "./usePlaybackDataLoader";

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolveFn: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  });
  return {
    promise,
    resolve: (value: T) => resolveFn?.(value),
  };
}

function seedReadyState(input?: Partial<ReturnType<typeof usePlaybackStore.getState>>): void {
  act(() => {
    usePlaybackStore.setState({
      isDialogOpen: false,
      isBarVisible: true,
      isOpen: true,
      mode: "viewport",
      queryViewport: {
        north: 20,
        south: 10,
        east: 110,
        west: 100,
      },
      freezeViewport: true,
      timeFrom: "2026-03-02T00:00",
      timeTo: "2026-03-02T12:00",
      currentTime: "2026-03-02T06:00",
      currentFrameIndex: 2,
      speedMs: 50,
      speedMultiplier: 300,
      timelineZoomLevel: 1,
      frameIntervalMs: 15_000,
      isPlaying: true,
      status: "ready",
      error: null,
      frames: [
        { timestamp: new Date("2026-03-02T06:00:00Z").getTime(), aircraft: [] },
        { timestamp: new Date("2026-03-02T06:01:00Z").getTime(), aircraft: [] },
        { timestamp: new Date("2026-03-02T06:02:00Z").getTime(), aircraft: [] },
      ],
      frameCount: 3,
      totalFrames: 3,
      hasMore: false,
      nextCursor: null,
      isPreFetching: false,
      pendingSeekTimeMs: null,
      ...input,
    });
  });
}

describe("usePlaybackDataLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    viewportState.value = {
      north: 20,
      south: 10,
      east: 110,
      west: 100,
    };

    mockFetchPlaybackFrames.mockResolvedValue({
      frames: [],
      totalFrames: 1,
      returnedFrames: 1,
      hasMore: false,
      nextCursor: null,
      bucketSizeMs: 60_000,
      metadata: {
        queryTimeMs: 5,
        totalAircraftSeen: 1,
      },
    });
    mockToPlaybackFrames.mockReturnValue([
      {
        timestamp: new Date("2026-03-02T06:05:00Z").getTime(),
        aircraft: [],
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("reloads buffer on debounced viewport change and resumes playback", async () => {
    seedReadyState({ isPlaying: true });

    const { rerender } = renderHook(() => usePlaybackDataLoader());

    act(() => {
      viewportState.value = {
        north: 25,
        south: 12,
        east: 112,
        west: 101,
      };
      rerender();
      vi.advanceTimersByTime(299);
    });

    expect(mockFetchPlaybackFrames).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
    });

    expect(mockFetchPlaybackFrames).toHaveBeenCalledTimes(1);
    expect(mockFetchPlaybackFrames).toHaveBeenCalledWith({
      timeFrom: new Date("2026-03-02T06:00").getTime(),
      timeTo: new Date("2026-03-02T12:00").getTime(),
      boundingBox: {
        north: 25,
        south: 12,
        east: 112,
        west: 101,
      },
      maxFrames: 200,
      cursor: null,
    }, expect.any(AbortSignal));

    const state = usePlaybackStore.getState();
    expect(state.queryViewport).toEqual({
      north: 25,
      south: 12,
      east: 112,
      west: 101,
    });
    expect(state.isPlaying).toBe(true);
  });

  test("seek reload resets pending seek flag and fetches from seek position", async () => {
    const seekTimeMs = new Date("2026-03-02T09:00").getTime();
    seedReadyState({ pendingSeekTimeMs: seekTimeMs, isPlaying: false });

    renderHook(() => usePlaybackDataLoader());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchPlaybackFrames).toHaveBeenCalledTimes(1);
    expect(mockFetchPlaybackFrames).toHaveBeenCalledWith({
      timeFrom: seekTimeMs,
      timeTo: new Date("2026-03-02T12:00").getTime(),
      boundingBox: {
        north: 20,
        south: 10,
        east: 110,
        west: 100,
      },
      maxFrames: 200,
      cursor: null,
    }, expect.any(AbortSignal));
    expect(usePlaybackStore.getState().pendingSeekTimeMs).toBeNull();
  });

  test("ignores stale viewport reload response when a newer request wins", async () => {
    seedReadyState({ isPlaying: false });

    const firstResponse = {
      frames: [],
      totalFrames: 1,
      returnedFrames: 1,
      hasMore: false,
      nextCursor: null,
      bucketSizeMs: 60_000,
      metadata: {
        queryTimeMs: 11,
        totalAircraftSeen: 1,
      },
    };
    const secondResponse = {
      frames: [],
      totalFrames: 1,
      returnedFrames: 1,
      hasMore: false,
      nextCursor: null,
      bucketSizeMs: 60_000,
      metadata: {
        queryTimeMs: 22,
        totalAircraftSeen: 1,
      },
    };

    const firstDeferred = createDeferred<typeof firstResponse>();
    const secondDeferred = createDeferred<typeof secondResponse>();

    mockFetchPlaybackFrames
      .mockImplementationOnce(() => firstDeferred.promise)
      .mockImplementationOnce(() => secondDeferred.promise);
    mockToPlaybackFrames.mockImplementation((response: { metadata: { queryTimeMs: number } }) => [
      {
        timestamp: response.metadata.queryTimeMs,
        aircraft: [],
      },
    ]);

    const { rerender } = renderHook(() => usePlaybackDataLoader());

    await act(async () => {
      viewportState.value = {
        north: 25,
        south: 12,
        east: 112,
        west: 101,
      };
      rerender();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runOnlyPendingTimersAsync();
    });

    await act(async () => {
      viewportState.value = {
        north: 26,
        south: 13,
        east: 113,
        west: 102,
      };
      rerender();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(mockFetchPlaybackFrames).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstDeferred.resolve(firstResponse);
      await Promise.resolve();
    });

    expect(mockToPlaybackFrames).toHaveBeenCalledTimes(0);

    await act(async () => {
      secondDeferred.resolve(secondResponse);
      await Promise.resolve();
    });

    expect(mockToPlaybackFrames).toHaveBeenCalledTimes(1);
    expect(usePlaybackStore.getState().frames[0]?.timestamp).toBe(22);
    expect(usePlaybackStore.getState().queryViewport).toEqual({
      north: 26,
      south: 13,
      east: 113,
      west: 102,
    });
  });

  test("skips empty windows automatically until data is found (large time range)", async () => {
    // Simulate a 6-day range where the first two 3.3-hour windows are empty
    // and data is only found in the third window.
    const seekTimeMs = new Date("2026-03-02T00:00").getTime();
    seedReadyState({ pendingSeekTimeMs: seekTimeMs, isPlaying: false });

    const emptyCursor1 = "cursor-skip-1";
    const emptyCursor2 = "cursor-skip-2";

    const emptyWindow = (nextCursor: string) => ({
      frames: [],
      totalFrames: 0,
      returnedFrames: 0,
      hasMore: false,
      nextCursor,
      bucketSizeMs: 60_000,
      metadata: { queryTimeMs: 5, totalAircraftSeen: 0 },
    });

    const dataWindow = {
      frames: [],
      totalFrames: 1,
      returnedFrames: 1,
      hasMore: false,
      nextCursor: null,
      bucketSizeMs: 60_000,
      metadata: { queryTimeMs: 8, totalAircraftSeen: 1 },
    };

    mockFetchPlaybackFrames
      .mockResolvedValueOnce(emptyWindow(emptyCursor1))
      .mockResolvedValueOnce(emptyWindow(emptyCursor2))
      .mockResolvedValueOnce(dataWindow);

    const expectedFrame = { timestamp: new Date("2026-03-02T08:00:00Z").getTime(), aircraft: [] };
    mockToPlaybackFrames
      .mockReturnValueOnce([])  // round 1 — skipped, not called
      .mockReturnValueOnce([])  // round 2 — skipped, not called
      .mockReturnValueOnce([expectedFrame]);

    renderHook(() => usePlaybackDataLoader());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Three fetches: cursor=null → cursor-skip-1 → cursor-skip-2
    expect(mockFetchPlaybackFrames).toHaveBeenCalledTimes(3);
    expect(mockFetchPlaybackFrames).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cursor: null }),
      expect.any(AbortSignal),
    );
    expect(mockFetchPlaybackFrames).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: emptyCursor1 }),
      expect.any(AbortSignal),
    );
    expect(mockFetchPlaybackFrames).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ cursor: emptyCursor2 }),
      expect.any(AbortSignal),
    );

    // setFrames is called only once with the actual data — store must be ready
    const state = usePlaybackStore.getState();
    expect(state.status).toBe("ready");
    expect(state.frames[0]?.timestamp).toBe(expectedFrame.timestamp);
  });
});
