import type { MapTileProvider } from "./types";
import { register, unregister } from "./registry";

const STORAGE_KEY = "tracking-custom-map-providers";

export function loadCustomProviders(): MapTileProvider[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed as MapTileProvider[];
    } catch {
        return [];
    }
}

function saveCustomProviders(providers: MapTileProvider[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

export function registerCustomProviders(): void {
    const providers = loadCustomProviders();
    for (const provider of providers) {
        register(provider);
    }
}

export function addCustomProvider(provider: MapTileProvider): void {
    const providers = loadCustomProviders();
    const existing = providers.findIndex((p) => p.id === provider.id);
    if (existing >= 0) {
        providers[existing] = provider;
    } else {
        providers.push(provider);
    }
    saveCustomProviders(providers);
    register(provider);
}

export function removeCustomProvider(providerId: string): void {
    const providers = loadCustomProviders().filter((p) => p.id !== providerId);
    saveCustomProviders(providers);
    unregister(providerId);
}
