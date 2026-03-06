import { registerBuiltinProviders } from "./builtinProviders";
import { registerCustomProviders } from "./customProviderStorage";
import { applyExternalProviderConfig } from "./providerConfig";

let bootstrapped = false;

export function initializeMapProviders(): void {
  if (bootstrapped) {
    return;
  }

  registerBuiltinProviders();
  applyExternalProviderConfig();
  registerCustomProviders();
  bootstrapped = true;
}
