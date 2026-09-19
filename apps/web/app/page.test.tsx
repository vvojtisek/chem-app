import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("presents all four learning modes", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Anorganická chemie");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.getByText("Periodická tabulka")).toBeInTheDocument();
    expect(screen.getByText("Chemické rovnice")).toBeInTheDocument();
    expect(screen.getByText("Názvosloví")).toBeInTheDocument();
    expect(screen.getByText("Výskyt a výroba")).toBeInTheDocument();
  });
});
