import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { I18nProvider, useI18n } from "./I18nProvider";

function TestProbe(): JSX.Element {
  const { language, setLanguage, t } = useI18n();

  return (
    <div>
      <span>{language}</span>
      <span>{t("toolbar.search")}</span>
      <button onClick={() => setLanguage("en")} type="button">
        switch
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  test("uses Vietnamese by default when wrapped with provider", () => {
    render(
      <I18nProvider>
        <TestProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("vi")).toBeInTheDocument();
    expect(screen.getByText("Tìm kiếm")).toBeInTheDocument();
  });

  test("switches language at runtime", () => {
    render(
      <I18nProvider>
        <TestProbe />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("en")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });
});
