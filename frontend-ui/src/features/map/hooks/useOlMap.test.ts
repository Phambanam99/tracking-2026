import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ─── Hoist shared spy functions so vi.mock blocks can reference them ──────────

const { mockSetTarget, mockOn, mockUn } = vi.hoisted(() => ({
  mockSetTarget: vi.fn(),
  mockOn: vi.fn(),
  mockUn: vi.fn(),
}));

// ─── Mock OpenLayers modules (canvas/WebGL not available in jsdom) ────────────
// Use class syntax so `new OlMap()` / `new View()` constructors succeed.

vi.mock("ol/Map", () => ({
  default: class MockMap {
    setTarget = mockSetTarget;
    on = mockOn;
    un = mockUn;
    constructor(_opts: unknown) {} // eslint-disable-line @typescript-eslint/no-unused-vars
    getView() {
      return { getZoom: () => 6, calculateExtent: () => [0, 0, 1, 1] };
    }
  },
}));

vi.mock("ol/View", () => ({
  default: class MockView {
    constructor(_opts: unknown) {} // eslint-disable-line @typescript-eslint/no-unused-vars
  },
}));

vi.mock("ol/proj", () => ({
  fromLonLat: vi.fn().mockImplementation((c: number[]) => c),
}));

vi.mock("../layers/baseLayer", () => ({
  createBaseLayer: vi.fn().mockReturnValue({ type: "mock-base-layer" }),
}));

// ─── Import code under test AFTER mocks are declared ─────────────────────────

import { useOlMap } from "./useOlMap";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainerRef(): React.RefObject<HTMLDivElement | null> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return { current: div } as React.RefObject<HTMLDivElement | null>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useOlMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("returns null when container ref has no current element", () => {
    const emptyRef: React.RefObject<HTMLDivElement | null> = { current: null };
    const { result } = renderHook(() => useOlMap(emptyRef));
    expect(result.current).toBeNull();
  });

  test("returns a Map instance once container div is mounted", () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() => useOlMap(containerRef));
    expect(result.current).not.toBeNull();
  });

  test("the Map instance exposes the expected mock methods", () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() => useOlMap(containerRef));
    expect(result.current?.setTarget).toBe(mockSetTarget);
    expect(result.current?.on).toBe(mockOn);
  });

  test("calls setTarget(undefined) on unmount (cleanup)", () => {
    const containerRef = makeContainerRef();
    const { unmount } = renderHook(() => useOlMap(containerRef));
    unmount();
    expect(mockSetTarget).toHaveBeenCalledWith(undefined);
  });

  test("does not create a second Map instance on re-render (idempotent)", () => {
    const containerRef = makeContainerRef();
    const { rerender } = renderHook(() => useOlMap(containerRef));
    rerender();
    rerender();
    // setTarget(undefined) = cleanup; must not have been called yet
    expect(mockSetTarget).not.toHaveBeenCalledWith(undefined);
  });
});
