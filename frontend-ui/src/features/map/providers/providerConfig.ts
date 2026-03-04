import { get, getDefault, list, register } from "./registry";
import type { MapTileProvider, TileSourceType } from "./types";

type RawProvider = Partial<MapTileProvider> & { id?: unknown; sourceType?: unknown };

const VALID_SOURCE_TYPES: TileSourceType[] = ["osm", "xyz", "tms", "wms", "wmts", "mvt"];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isValidSourceType(value: unknown): value is TileSourceType {
  return typeof value === "string" && VALID_SOURCE_TYPES.includes(value as TileSourceType);
}

function isValidProvider(raw: RawProvider): raw is MapTileProvider {
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    return false;
  }

  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    return false;
  }

  if (raw.category !== "online" && raw.category !== "offline" && raw.category !== "custom") {
    return false;
  }

  if (!isValidSourceType(raw.sourceType)) {
    return false;
  }

  if (
    (raw.sourceType === "xyz" || raw.sourceType === "tms") &&
    (typeof raw.url !== "string" || raw.url.trim().length === 0)
  ) {
    return false;
  }

  if (raw.sourceType === "wms") {
    if (typeof raw.url !== "string" || raw.url.trim().length === 0) {
      return false;
    }

    if (typeof raw.wmsLayers !== "string" || raw.wmsLayers.trim().length === 0) {
      return false;
    }
  }

  if (raw.sourceType === "wmts") {
    if (typeof raw.url !== "string" || raw.url.trim().length === 0) {
      return false;
    }

    if (typeof raw.wmtsLayer !== "string" || raw.wmtsLayer.trim().length === 0) {
      return false;
    }

    if (typeof raw.wmtsMatrixSet !== "string" || raw.wmtsMatrixSet.trim().length === 0) {
      return false;
    }

    if ((raw.wmtsMatrixIds && !raw.wmtsResolutions) || (!raw.wmtsMatrixIds && raw.wmtsResolutions)) {
      return false;
    }

    if (raw.wmtsMatrixIds && !isStringArray(raw.wmtsMatrixIds)) {
      return false;
    }

    if (raw.wmtsResolutions && !isNumberArray(raw.wmtsResolutions)) {
      return false;
    }

    if (
      raw.wmtsMatrixIds &&
      raw.wmtsResolutions &&
      raw.wmtsMatrixIds.length !== raw.wmtsResolutions.length
    ) {
      return false;
    }
  }

  if (raw.sourceType === "mvt") {
    if (typeof raw.url !== "string" || raw.url.trim().length === 0) {
      return false;
    }
  }

  return true;
}

export function parseProviderConfig(rawJson: string): MapTileProvider[] {
  const parsed: unknown = JSON.parse(rawJson);

  if (!Array.isArray(parsed)) {
    throw new Error("VITE_MAP_PROVIDERS must be a JSON array.");
  }

  const providers: MapTileProvider[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      console.warn("[map/providers] Ignoring non-object provider entry from VITE_MAP_PROVIDERS.");
      continue;
    }

    const candidate = entry as RawProvider;
    if (!isValidProvider(candidate)) {
      console.warn("[map/providers] Ignoring invalid provider entry from VITE_MAP_PROVIDERS.", candidate);
      continue;
    }

    providers.push(candidate);
  }

  return providers;
}

export function applyExternalProviderConfig(): void {
  const providerJson = import.meta.env.VITE_MAP_PROVIDERS;
  if (providerJson) {
    try {
      const externalProviders = parseProviderConfig(providerJson);
      for (const provider of externalProviders) {
        register(provider);
      }
    } catch (error) {
      console.warn("[map/providers] Failed to parse VITE_MAP_PROVIDERS. Ignoring external providers.", error);
    }
  }

  const configuredDefaultId = import.meta.env.VITE_MAP_DEFAULT_PROVIDER;
  if (!configuredDefaultId) {
    return;
  }

  const configuredDefault = get(configuredDefaultId);
  if (!configuredDefault) {
    console.warn(
      `[map/providers] VITE_MAP_DEFAULT_PROVIDER=\"${configuredDefaultId}\" is not registered. Falling back to default provider.`,
    );
    return;
  }

  const currentProviders = list();
  for (const provider of currentProviders) {
    register({ ...provider, isDefault: provider.id === configuredDefault.id });
  }

  if (!get(configuredDefaultId)) {
    const defaultProvider = getDefault();
    console.warn(
      `[map/providers] Failed to apply configured default provider. Current default is \"${defaultProvider.id}\".`,
    );
  }
}
