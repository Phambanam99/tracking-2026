import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UserManagementPage } from "./UserManagementPage";
import { disableUser, enableUser, listUsers } from "../api/userAdminApi";

vi.mock("../api/userAdminApi", () => ({
  listUsers: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
}));

describe("UserManagementPage", () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockResolvedValue({
      content: [
        {
          id: 7,
          username: "pilot",
          email: "pilot@example.com",
          enabled: true,
          roles: ["ROLE_USER"],
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    vi.mocked(disableUser).mockResolvedValue(undefined);
    vi.mocked(enableUser).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should load users and disable selected user", async () => {
    render(<UserManagementPage />);

    expect(await screen.findByText("pilot")).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledWith(0, 20);

    fireEvent.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() => {
      expect(disableUser).toHaveBeenCalledWith(7);
    });
  });
});
