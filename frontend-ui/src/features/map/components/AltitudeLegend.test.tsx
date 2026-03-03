import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AltitudeLegend } from "./AltitudeLegend";

describe("AltitudeLegend", () => {
  test("renders compact altitude bar and edge labels", () => {
    render(<AltitudeLegend />);

    expect(screen.getByText("Altitude")).toBeInTheDocument();
    expect(screen.getByText("Ground")).toBeInTheDocument();
    expect(screen.getAllByText("30k+ ft").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(">= 30,000 ft")).toBeInTheDocument();
  });
});
