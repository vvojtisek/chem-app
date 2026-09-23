import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PracticeHubPage from "./page";

describe("PracticeHubPage", () => {
  it("lists the practice categories with their exercises and a way home", () => {
    render(<PracticeHubPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vyberte kategorii");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
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
    expect(screen.getByRole("link", { name: /Domů/ })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /Zpět/ })).toBeNull();
  });
});
