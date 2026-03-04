import { registerBuiltinProviders } from "./builtinProviders";
import { applyExternalProviderConfig } from "./providerConfig";

let bootstrapped = false;

export function initializeMapProviders(): void {
  if (bootstrapped) {
    return;
  }

  registerBuiltinProviders();
  applyExternalProviderConfig();
  bootstrapped = true;
}
