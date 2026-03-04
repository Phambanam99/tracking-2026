import type { MapTileProvider } from "./types";

const FALLBACK_PROVIDER: MapTileProvider = {
  id: "osm",
  name: "OpenStreetMap",
  category: "online",
  sourceType: "osm",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  isDefault: true,
};

const providers = new Map<string, MapTileProvider>();

function cloneProvider(provider: MapTileProvider): MapTileProvider {
  return { ...provider };
}

function normalizeProvider(provider: MapTileProvider): MapTileProvider {
  return cloneProvider(provider);
}

function ensureFallbackProvider(): void {
  if (!providers.has(FALLBACK_PROVIDER.id)) {
    providers.set(FALLBACK_PROVIDER.id, cloneProvider(FALLBACK_PROVIDER));
  }
}

function getDefaultFromRegistry(): MapTileProvider | null {
  for (const provider of providers.values()) {
    if (provider.isDefault) {
      return cloneProvider(provider);
    }
  }
  return null;
}

function hasAnyProvider(): boolean {
  return providers.size > 0;
}

export function register(provider: MapTileProvider): void {
  const wasEmpty = providers.size === 0;
  const normalized = normalizeProvider(provider);
  if (wasEmpty && normalized.isDefault !== true) {
    normalized.isDefault = true;
  }

  providers.set(normalized.id, normalized);

  if (normalized.isDefault) {
    for (const [id, value] of providers.entries()) {
      if (id !== normalized.id && value.isDefault) {
        providers.set(id, { ...value, isDefault: false });
      }
    }
    return;
  }

  const hasDefault = Array.from(providers.values()).some((value) => value.isDefault);
  if (!hasDefault) {
    providers.set(normalized.id, { ...normalized, isDefault: true });
  }
}

export function unregister(id: string): void {
  providers.delete(id);
}

export function get(id: string): MapTileProvider | null {
  const provider = providers.get(id);
  return provider ? cloneProvider(provider) : null;
}

export function getDefault(): MapTileProvider {
  const selectedDefault = getDefaultFromRegistry();
  if (selectedDefault) {
    return selectedDefault;
  }

  ensureFallbackProvider();
  return cloneProvider(providers.get(FALLBACK_PROVIDER.id)!);
}

export function getOrDefault(id?: string): MapTileProvider {
  if (id) {
    const found = get(id);
    if (found) {
      return found;
    }
  }
  return getDefault();
}

export function list(): MapTileProvider[] {
  if (!hasAnyProvider()) {
    ensureFallbackProvider();
  }
  return Array.from(providers.values()).map(cloneProvider);
}

export function clearRegistryForTests(): void {
  providers.clear();
}
