import { beforeEach, describe, expect, test } from "vitest";
import {
  clearRegistryForTests,
  get,
  getDefault,
  getOrDefault,
  list,
  register,
  unregister,
} from "./registry";
import type { MapTileProvider } from "./types";

const PROVIDER_A: MapTileProvider = {
  id: "provider-a",
  name: "Provider A",
  category: "online",
  sourceType: "osm",
};

const PROVIDER_B: MapTileProvider = {
  id: "provider-b",
  name: "Provider B",
  category: "custom",
  sourceType: "xyz",
  url: "https://tiles.example.com/{z}/{x}/{y}.png",
};

describe("provider registry", () => {
  beforeEach(() => {
    clearRegistryForTests();
  });

  test("register/get/unregister lifecycle works", () => {
    register(PROVIDER_A);

    expect(get("provider-a")?.name).toBe("Provider A");

    unregister("provider-a");
    expect(get("provider-a")).toBeNull();
  });

  test("duplicate id registration overwrites existing provider", () => {
    register(PROVIDER_A);
    register({ ...PROVIDER_A, name: "Provider A Updated" });

    expect(get("provider-a")?.name).toBe("Provider A Updated");
  });

  test("getOrDefault returns default provider for unknown id", () => {
    register(PROVIDER_A);
    register(PROVIDER_B);

    const unknown = getOrDefault("unknown-id");
    expect(unknown.id).toBe(getDefault().id);
  });

  test("list/getDefault fallback to hardcoded osm when registry is empty", () => {
    const providers = list();
    const fallback = getDefault();

    expect(providers.length).toBeGreaterThan(0);
    expect(fallback.id).toBe("osm");
    expect(fallback.sourceType).toBe("osm");
  });
});
