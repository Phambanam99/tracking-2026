import { describe, expect, test, vi } from "vitest";
import { buildSvgDataUri, createAircraftStyle } from "./aircraftStyle";
import type { ShapeDefinition } from "../db/markers";

// ── OL mocks ──────────────────────────────────────────────────────────────────
// OL classes cannot be instantiated in jsdom because they rely on browser canvas.
// We replace them with minimal class stubs that capture constructor arguments.

const mockIconOptions: Record<string, unknown>[] = [];
const mockStyleOptions: Record<string, unknown>[] = [];

vi.mock("ol/style/Icon", () => ({
  default: class MockIcon {
    constructor(opts: Record<string, unknown>) {
      mockIconOptions.push(opts);
    }
  },
}));

vi.mock("ol/style/Style", () => ({
  default: class MockStyle {
    constructor(opts: Record<string, unknown>) {
      mockStyleOptions.push(opts);
    }
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SIMPLE_SHAPE: ShapeDefinition = {
  path: "M 16 2 L 30 30 L 16 24 L 2 30 Z",
  viewBox: "0 0 32 32",
  w: 32,
  h: 32,
};

const MULTI_PATH_SHAPE: ShapeDefinition = {
  path: [
    "M 16 2 L 30 30 L 16 24 L 2 30 Z",
    "M 16 10 L 16 22",
  ],
  viewBox: "0 0 32 32",
  w: 32,
  h: 32,
};

const NO_ROTATE_SHAPE: ShapeDefinition = {
  path: "M 4 4 L 28 4 L 28 28 L 4 28 Z",
  viewBox: "0 0 32 32",
  w: 32,
  h: 32,
  noRotate: true,
};

// ── buildSvgDataUri ───────────────────────────────────────────────────────────

describe("buildSvgDataUri", () => {
  test("returns a base64 data URI starting with the svg prefix", () => {
    const uri = buildSvgDataUri(SIMPLE_SHAPE, "#00ff00", "#000000");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  test("decoded SVG contains the <svg> root element", () => {
    const uri = buildSvgDataUri(SIMPLE_SHAPE, "#00ff00", "#000000");
    const base64Part = uri.replace("data:image/svg+xml;base64,", "");
    const svg = atob(base64Part);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  test("decoded SVG contains the shape path data", () => {
    const uri = buildSvgDataUri(SIMPLE_SHAPE, "#ff0000", "#000000");
    const svg = atob(uri.replace("data:image/svg+xml;base64,", ""));
    expect(svg).toContain("M 16 2");
  });

  test("decoded SVG contains the fill colour", () => {
    const uri = buildSvgDataUri(SIMPLE_SHAPE, "#ff0000", "#000000");
    const svg = atob(uri.replace("data:image/svg+xml;base64,", ""));
    expect(svg).toContain('fill="#ff0000"');
  });

  test("decoded SVG contains the stroke colour", () => {
    const uri = buildSvgDataUri(SIMPLE_SHAPE, "#00ff00", "#ffffff");
    const svg = atob(uri.replace("data:image/svg+xml;base64,", ""));
    expect(svg).toContain('stroke="#ffffff"');
  });

  test("multi-path shapes produce multiple <path> elements", () => {
    const uri = buildSvgDataUri(MULTI_PATH_SHAPE, "#00ff00", "#000000");
    const svg = atob(uri.replace("data:image/svg+xml;base64,", ""));
    const pathCount = (svg.match(/<path/g) ?? []).length;
    expect(pathCount).toBe(2);
  });

  test("second path in multi-path shape has fill=none", () => {
    const uri = buildSvgDataUri(MULTI_PATH_SHAPE, "#0000ff", "#000000");
    const svg = atob(uri.replace("data:image/svg+xml;base64,", ""));
    expect(svg).toContain('fill="none"');
  });

  test("iconScale affects width and height in SVG attributes", () => {
    const uri1 = buildSvgDataUri(SIMPLE_SHAPE, "#00ff00", "#000000", 1.0);
    const uri2 = buildSvgDataUri(SIMPLE_SHAPE, "#00ff00", "#000000", 2.0);
    const svg1 = atob(uri1.replace("data:image/svg+xml;base64,", ""));
    const svg2 = atob(uri2.replace("data:image/svg+xml;base64,", ""));
    expect(svg1).toContain('width="32.0"');
    expect(svg2).toContain('width="64.0"');
  });
});

// ── createAircraftStyle ───────────────────────────────────────────────────────

describe("createAircraftStyle", () => {
  test("returns an OL Style instance", () => {
    mockIconOptions.length = 0;
    mockStyleOptions.length = 0;

    createAircraftStyle({ shape: SIMPLE_SHAPE });

    // Both constructors should have been called once
    expect(mockIconOptions).toHaveLength(1);
    expect(mockStyleOptions).toHaveLength(1);
  });

  test("Icon src is a valid svg data URI", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE });
    const src = mockIconOptions[0]?.src as string;
    expect(src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  test("heading in degrees is converted to radians for rotation", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE, heading: 90 });
    const rotation = mockIconOptions[0]?.rotation as number;
    expect(rotation).toBeCloseTo(Math.PI / 2, 5);
  });

  test("zero rotation when heading is null", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE, heading: null });
    expect(mockIconOptions[0]?.rotation).toBe(0);
  });

  test("selected aircraft uses yellow fill colour", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE, isSelected: true });
    const src = mockIconOptions[0]?.src as string;
    const svg = atob(src.replace("data:image/svg+xml;base64,", ""));
    expect(svg).toContain("#ffdd00");
  });

  test("ground altitude results in gray fill", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE, altitude: 0 });
    const src = mockIconOptions[0]?.src as string;
    const svg = atob(src.replace("data:image/svg+xml;base64,", ""));
    expect(svg).toContain("#808080");
  });

  test("noRotate shape has rotation 0 regardless of heading", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: NO_ROTATE_SHAPE, heading: 270 });
    expect(mockIconOptions[0]?.rotation).toBe(0);
  });

  test("noRotate shape sets rotateWithView to false", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: NO_ROTATE_SHAPE });
    expect(mockIconOptions[0]?.rotateWithView).toBe(false);
  });

  test("normal shape sets rotateWithView to true", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE });
    expect(mockIconOptions[0]?.rotateWithView).toBe(true);
  });

  test("passes through opacity to the OL icon", () => {
    mockIconOptions.length = 0;
    createAircraftStyle({ shape: SIMPLE_SHAPE, opacity: 0.25 });
    expect(mockIconOptions[0]?.opacity).toBe(0.25);
  });
});
