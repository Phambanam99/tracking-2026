import { create } from "zustand";
import { initializeMapProviders } from "./initProviders";
import { get, getDefault } from "./registry";

initializeMapProviders();

type BaseLayerStore = {
  activeProviderId: string;
  setProvider: (providerId: string) => void;
};

function resolveValidProviderId(providerId: string): string {
  const provider = get(providerId);
  if (provider) {
    return provider.id;
  }
  return getDefault().id;
}

export const useBaseLayerStore = create<BaseLayerStore>((set) => ({
  activeProviderId: getDefault().id,
  setProvider: (providerId) =>
    set(() => ({
      activeProviderId: resolveValidProviderId(providerId),
    })),
}));
