import { register } from "./registry";
import type { MapTileProvider } from "./types";

export const BUILTIN_PROVIDERS: MapTileProvider[] = [
  {
    id: "osm",
    name: "OpenStreetMap",
    labelKey: "map.provider.osm",
    category: "online",
    sourceType: "osm",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    isDefault: true,
  },
  {
    id: "esri-satellite",
    name: "Esri Satellite",
    labelKey: "map.provider.esriSatellite",
    category: "online",
    sourceType: "xyz",
    attribution:
      "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    crossOrigin: "anonymous",
  },
  {
    id: "esri-topo",
    name: "Esri Topo",
    labelKey: "map.provider.esriTopo",
    category: "online",
    sourceType: "xyz",
    attribution: "Tiles © Esri",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    crossOrigin: "anonymous",
  },
  {
    id: "cartodb-dark",
    name: "CartoDB Dark",
    labelKey: "map.provider.cartoDark",
    category: "online",
    sourceType: "xyz",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
    url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    maxZoom: 20,
    crossOrigin: "anonymous",
  },
  {
    id: "cartodb-light",
    name: "CartoDB Light",
    labelKey: "map.provider.cartoLight",
    category: "online",
    sourceType: "xyz",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
    url: "https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    maxZoom: 20,
    crossOrigin: "anonymous",
  },
];

let initialized = false;

export function registerBuiltinProviders(): void {
  if (initialized) {
    return;
  }

  for (const provider of BUILTIN_PROVIDERS) {
    register(provider);
  }

  initialized = true;
}

export function resetBuiltinProvidersForTests(): void {
  initialized = false;
}
