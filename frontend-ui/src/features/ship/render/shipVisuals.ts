import type { Ship } from "../types/shipTypes";

export type ShipVisualStyle = {
  color: string;
  selectedColor: string;
  category: "military" | "cargo" | "tanker" | "passenger" | "fishing" | "service" | "default";
};

export function resolveShipVisualStyle(ship: Pick<Ship, "vesselType" | "metadata">, isTracked: boolean): ShipVisualStyle {
  if (isTracked) {
    return {
      color: "#facc15",
      selectedColor: "#fef08a",
      category: "default",
    };
  }

  if (ship.metadata?.isMilitary) {
    return {
      color: "#f97316",
      selectedColor: "#fb923c",
      category: "military",
    };
  }

  const vesselType = `${ship.metadata?.shipTypeName ?? ""} ${ship.vesselType ?? ""}`.toLowerCase();

  if (matches(vesselType, ["cargo", "bulk", "container", "freighter"])) {
    return {
      color: "#14b8a6",
      selectedColor: "#2dd4bf",
      category: "cargo",
    };
  }

  if (matches(vesselType, ["tanker", "oil", "lng", "gas"])) {
    return {
      color: "#0ea5e9",
      selectedColor: "#38bdf8",
      category: "tanker",
    };
  }

  if (matches(vesselType, ["passenger", "cruise", "ferry", "ro-ro"])) {
    return {
      color: "#a855f7",
      selectedColor: "#c084fc",
      category: "passenger",
    };
  }

  if (matches(vesselType, ["fishing", "trawler"])) {
    return {
      color: "#f59e0b",
      selectedColor: "#fbbf24",
      category: "fishing",
    };
  }

  if (matches(vesselType, ["tug", "pilot", "patrol", "service", "dredger"])) {
    return {
      color: "#e879f9",
      selectedColor: "#f0abfc",
      category: "service",
    };
  }

  return {
    color: "#22c55e",
    selectedColor: "#4ade80",
    category: "default",
  };
}

function matches(vesselType: string, candidates: string[]): boolean {
  return candidates.some((candidate) => vesselType.includes(candidate));
}
