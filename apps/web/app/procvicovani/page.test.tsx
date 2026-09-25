import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PracticeHubPage from "./page";

describe("PracticeHubPage", () => {
  it("lists the practice categories with their exercises", () => {
    render(<PracticeHubPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Procvičovat");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Procvičit názvy a značky" })).toHaveAttribute(
      "href",
      "/procvicovani/prvky",
    );
    expect(screen.getByRole("link", { name: "Procvičit pozice" })).toHaveAttribute(
      "href",
      "/procvicovani/periodicka-tabulka",
    );
    expect(screen.getByRole("link", { name: "Procvičit názvosloví" })).toHaveAttribute(
      "href",
      "/procvicovani/nazvoslovi",
    );
    expect(screen.getByRole("link", { name: "Procvičit rovnice" })).toHaveAttribute(
      "href",
      "/procvicovani/rovnice",
    );
    expect(screen.getByRole("link", { name: "Procházet výskyt a výrobu" })).toHaveAttribute(
      "href",
      "/uceni/priprava-vyroba",
    );
    expect(screen.queryByRole("navigation", { name: "Drobečková navigace" })).toBeNull();
  });
});
