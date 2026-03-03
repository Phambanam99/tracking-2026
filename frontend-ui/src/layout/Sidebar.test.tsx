import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  test("opens menu and toggles search and watchlist actions", () => {
    function TestHost(): JSX.Element {
      const [activePanel, setActivePanel] = React.useState<"search" | "watchlist" | null>(null);

      return (
        <Sidebar
          activePanel={activePanel}
          isAdmin={false}
          isAuthenticated={true}
          onLogout={vi.fn()}
          onOpenAdminApiKeys={vi.fn()}
          onOpenAdminUsers={vi.fn()}
          onOpenLogin={vi.fn()}
          onOpenRegister={vi.fn()}
          onSelectPanel={setActivePanel}
          onShowMap={() => setActivePanel(null)}
          username="alice"
        />
      );
    }

    render(<TestHost />);

    fireEvent.click(screen.getByLabelText("Toggle navigation menu"));

    const searchButton = screen.getByLabelText("Open search panel");
    const watchlistButton = screen.getByLabelText("Open watchlist panel");

    expect(searchButton).toHaveAttribute("aria-pressed", "false");
    expect(watchlistButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(searchButton);

    fireEvent.click(screen.getByLabelText("Toggle navigation menu"));
    expect(screen.getByLabelText("Open search panel")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByLabelText("Open watchlist panel"));

    fireEvent.click(screen.getByLabelText("Toggle navigation menu"));
    expect(screen.getByLabelText("Open watchlist panel")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByLabelText("Open watchlist panel"));

    fireEvent.click(screen.getByLabelText("Toggle navigation menu"));
    expect(screen.getByLabelText("Open watchlist panel")).toHaveAttribute("aria-pressed", "false");
  });
});
