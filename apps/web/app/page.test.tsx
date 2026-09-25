import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth-gate", () => ({
  useAccount: () => ({ id: "guest", username: "host", role: "guest" }),
  useCapabilities: () => ({ canSave: false, canViewProgress: false }),
}));

import HomePage from "./page";

afterEach(cleanup);

function renderHome() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  it("presents the three practice areas", () => {
    renderHome();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Anorganická chemie");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByText("Periodická tabulka")).toBeInTheDocument();
    expect(screen.getByText("Chemické rovnice, výskyt a výroba")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Procvičit rovnice" })).toHaveAttribute(
      "href",
      "/procvicovani/rovnice",
    );
    expect(screen.getByRole("link", { name: "Procházet výskyt a výrobu" })).toHaveAttribute(
      "href",
      "/uceni/priprava-vyroba",
    );
    expect(screen.getByText("Názvosloví")).toBeInTheDocument();
  });

  it("links one element name and symbol practice next to the blind table and flashcards", () => {
    renderHome();

    expect(screen.getByRole("link", { name: "Procvičit názvy a značky" })).toHaveAttribute(
      "href",
      "/procvicovani/prvky",
    );
    expect(screen.queryByRole("link", { name: "Procvičit názvy" })).toBeNull();
    expect(screen.getByRole("link", { name: "Procvičit pozice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otevřít karty prvků" })).toBeInTheDocument();
    expect(screen.queryByText("Připravujeme obsah")).toBeNull();
  });
});
