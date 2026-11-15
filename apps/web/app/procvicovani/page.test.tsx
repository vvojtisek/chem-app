import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PracticeHubPage from "./page";

afterEach(cleanup);

describe("PracticeHubPage", () => {
  it("lists the practice categories with their exercises", () => {
    render(<PracticeHubPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Procvičovat");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Názvy a značky prvků" })).toHaveAttribute(
      "href",
      "/procvicovani/prvky",
    );
    expect(screen.getByRole("link", { name: "Slepá periodická tabulka" })).toHaveAttribute(
      "href",
      "/procvicovani/periodicka-tabulka",
    );
    expect(screen.getByRole("link", { name: "Názvosloví" })).toHaveAttribute(
      "href",
      "/procvicovani/nazvoslovi",
    );
    expect(screen.getByRole("link", { name: "Vyčíslování rovnic" })).toHaveAttribute(
      "href",
      "/procvicovani/rovnice",
    );
    expect(screen.getByRole("link", { name: "Příprava a výroba" })).toHaveAttribute(
      "href",
      "/procvicovani/priprava-vyroba",
    );
    expect(screen.queryByRole("navigation", { name: "Drobečková navigace" })).toBeNull();
  });

  it("renders every exercise as a link of the same button style, without arrows", () => {
    render(<PracticeHubPage />);

    const links = within(screen.getByRole("list", { name: "Oblasti procvičování" })).getAllByRole(
      "link",
    );
    expect(links.map((link) => link.textContent)).toEqual([
      "Názvy a značky prvků",
      "Pětiminutový kvíz prvků",
      "Slepá periodická tabulka",
      "Vyčíslování rovnic",
      "Příprava a výroba",
      "Názvosloví",
    ]);
    expect(new Set(links.map((link) => link.className)).size).toBe(1);
    for (const link of links) expect(link.querySelector("svg")).toBeNull();
  });
});
