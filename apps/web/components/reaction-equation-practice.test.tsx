import type { PreparationProductionRuntimeProduct } from "@inorganic/content/preparation-production";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appendAttempt = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ role: "user" }));

vi.mock("@/components/auth-gate", () => ({
  useAccount: () => ({ id: "11111111-1111-4111-8111-111111111111", role: auth.role }),
  useCapabilities: () => ({ canSave: auth.role !== "guest" }),
}));
vi.mock("@/lib/browser-progress-store", () => ({
  createBrowserProgressStore: () => ({ appendAttempt }),
}));

import { ReactionEquationPractice } from "./reaction-equation-practice";

const fixture: PreparationProductionRuntimeProduct = {
  id: "preparation-production.product.test-hydrogen",
  nameCs: "Vodík",
  formula: "H2",
  notes: [],
  routes: [
    {
      id: "preparation-production.route.test-hydrogen",
      sourceId: "id-test-hydrogen",
      kind: "manufacture",
      reactants: [
        { coefficient: 1, formula: "Zn" },
        { coefficient: 2, formula: "HCl" },
      ],
      products: [
        { coefficient: 1, formula: "H2" },
        { coefficient: 1, formula: "ZnCl2", acceptedAliases: ["Zn(Cl)2"] },
      ],
      conditionsCs: null,
    },
  ],
  reviewLevel: "owner-approved",
  sources: [{ title: "Fixture source", locator: "https://example.test/source" }],
};

function renderPractice() {
  render(<ReactionEquationPractice products={[fixture]} allowedSymbols={["Zn", "H", "Cl"]} />);
}

beforeEach(() => {
  auth.role = "user";
  appendAttempt.mockReset();
  appendAttempt.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("reaction equation practice", () => {
  it("shows atom counts after a wrong beginner answer and saves the retry", async () => {
    renderPractice();
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));
    expect(screen.getByText("To není správné řešení.")).toBeInTheDocument();
    expect(screen.getByText("Počty atomů ve vaší odpovědi")).toBeInTheDocument();
    expect(screen.getByText("Vlevo: Cl: 1 · H: 1 · Zn: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Koeficient reaktant HCl/ }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));
    expect(screen.getByText("Správně.")).toBeInTheDocument();
    await waitFor(() => expect(appendAttempt).toHaveBeenCalledTimes(2));
    expect(appendAttempt.mock.calls[0]?.[0]).toMatchObject({
      mode: "equation",
      level: "beginner",
      round: "initial",
      isCorrect: false,
    });
    expect(appendAttempt.mock.calls[1]?.[0]).toMatchObject({
      mode: "equation",
      level: "beginner",
      round: "retry",
      isCorrect: true,
    });
  });

  it("accepts reordered products and then balanced coefficients at advanced level", () => {
    renderPractice();
    fireEvent.click(screen.getByRole("button", { name: "Pokročilý" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Produkty na pravé straně/ }), {
      target: { value: "Zn(Cl)2 + H2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ověřit produkty" }));
    expect(screen.getByText("Nyní doplňte koeficienty na obou stranách.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Koeficient reaktant HCl/ }), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));
    expect(screen.getByText("Správně.")).toBeInTheDocument();
    expect(appendAttempt.mock.calls[0]?.[0]).toMatchObject({
      level: "advanced",
      direction: "products-and-coefficients",
      isCorrect: true,
    });
  });

  it("accepts a complete approved production equation at pro level", () => {
    renderPractice();
    fireEvent.click(screen.getByRole("button", { name: "Profík" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Chemická rovnice" }), {
      target: { value: "Zn + 2 HCl -> H2 + Zn(Cl)2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit rovnici" }));
    expect(screen.getByText("Správně.")).toBeInTheDocument();
    expect(appendAttempt.mock.calls[0]?.[0]).toMatchObject({
      level: "pro",
      direction: "complete-equation",
      isCorrect: true,
    });
  });

  it("lets a guest practice without writing attempts", () => {
    auth.role = "guest";
    renderPractice();
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));
    expect(screen.getByText("To není správné řešení.")).toBeInTheDocument();
    expect(appendAttempt).not.toHaveBeenCalled();
  });
});
