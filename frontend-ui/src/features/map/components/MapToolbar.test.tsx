import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "../../../shared/i18n/I18nProvider";
import { registerBuiltinProviders } from "../providers/builtinProviders";
import { MapToolbar } from "./MapToolbar";

describe("MapToolbar", () => {
  beforeEach(() => {
    registerBuiltinProviders();
  });

  test("renders registered providers and emits selected provider id", () => {
    const onProviderChange = vi.fn();

    render(
      <I18nProvider defaultLanguage="vi">
        <MapToolbar
          activeProviderId="osm"
          onProviderChange={onProviderChange}
          trackedCount={3}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "OpenStreetMap" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Esri Ảnh vệ tinh" })).toBeInTheDocument();
    expect(screen.getByText("3 tracked")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Esri Ảnh vệ tinh" }));

    expect(onProviderChange).toHaveBeenCalledWith("esri-satellite");
  });
});
