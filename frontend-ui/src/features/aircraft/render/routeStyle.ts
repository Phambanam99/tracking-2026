import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";

function toRouteTint(color: string, alpha: number): string {
  if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) {
    return color;
  }

  const normalized =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function createRouteBaseStyle(color = "#22d3ee"): Style {
  return new Style({
    stroke: new Stroke({
      color: toRouteTint(color, 0.32),
      width: 2,
      lineDash: [4, 3],
    }),
  });
}

export function createRouteActiveStyle(color = "#22d3ee"): Style {
  return new Style({
    stroke: new Stroke({
      color,
      width: 3,
    }),
  });
}

export function createRouteCurrentPointStyle(color = "#22d3ee"): Style {
  return new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: "#f8fafc" }),
      stroke: new Stroke({ color, width: 2 }),
    }),
  });
}
