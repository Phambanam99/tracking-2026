import type { LonLatExtent } from "../../map/types/mapTypes";
import type { Aircraft } from "../../aircraft/types/aircraftTypes";

export type PlaybackMode = "viewport";
export type PlaybackStatus = "idle" | "loading" | "ready" | "error";

export type PlaybackState = {
  isDialogOpen: boolean;
  isBarVisible: boolean;
  isOpen: boolean;
  mode: PlaybackMode;
  queryViewport: LonLatExtent | null;
  freezeViewport: boolean;
  timeFrom: string;
  timeTo: string;
  currentTime: string;
  currentFrameIndex: number;
  speedMs: number;
  speedMultiplier: number;
  timelineZoomLevel: number;
  frameIntervalMs: number;
  isPlaying: boolean;
  status: PlaybackStatus;
  error: string | null;
  frames: PlaybackFrame[];
  frameCount: number;
  totalFrames: number;
  hasMore: boolean;
  nextCursor: string | null;
  isPreFetching: boolean;
};

export type PlaybackFrame = {
  timestamp: number;
  aircraft: Aircraft[];
};
