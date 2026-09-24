import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import HomePage from "./page";

afterEach(cleanup);

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

  it("links one element name and symbol practice next to the blind table and flashcards", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "Procvičit názvy a značky" })).toHaveAttribute(
      "href",
      "/procvicovani/prvky",
    );
    expect(screen.queryByRole("link", { name: "Procvičit názvy" })).toBeNull();
    expect(screen.getByRole("link", { name: "Procvičit pozice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otevřít karty prvků" })).toBeInTheDocument();
    expect(screen.getAllByText("Připravujeme obsah")).toHaveLength(1);
  });
});
