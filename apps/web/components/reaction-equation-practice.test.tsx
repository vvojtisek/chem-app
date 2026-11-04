import {
  curatedPreparationProduction,
  type PreparationProductionRuntimeProduct,
} from "@inorganic/content/preparation-production";
import { curatedElements } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

/** Opens a balancing level; the practice starts at the easy choice level. */
function renderPractice(level = "Začátečník") {
  render(<ReactionEquationPractice products={[fixture]} allowedSymbols={["Zn", "H", "Cl"]} />);
  fireEvent.click(screen.getByRole("button", { name: level }));
}

/** Keeps every shuffle in its original order, so the answer is listed first. */
const keepOrder = () => 0.999;
const symbols = curatedElements.map((element) => element.symbol);

function renderChoice(random: () => number = keepOrder) {
  render(
    <ReactionEquationPractice
      allowedSymbols={symbols}
      products={curatedPreparationProduction}
      random={random}
    />,
  );
}

function choiceOptions() {
  return within(screen.getByRole("group", { name: "Produkty reakce" })).getAllByRole("button");
}

beforeEach(() => {
  auth.role = "user";
  appendAttempt.mockReset();
  appendAttempt.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("reaction equation practice", () => {
  it("starts at the easy level with four product options and no coefficients", () => {
    renderChoice();
    expect(screen.getByRole("button", { name: "Snadný" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Které produkty vzniknou?" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    const options = choiceOptions();
    expect(options).toHaveLength(4);
    expect(options.map((option) => option.textContent?.slice(0, 2))).toEqual([
      "a)",
      "b)",
      "c)",
      "d)",
    ]);
  });

  it("marks a wrong choice, offers a retry with new options, and saves no attempt", async () => {
    renderChoice();
    const [, wrong] = choiceOptions();
    if (!wrong) throw new Error("missing option");
    fireEvent.click(wrong);
    expect(screen.getByText("To není správné řešení.")).toBeInTheDocument();
    expect(screen.getByText(/^Celá rovnice:/u)).toBeInTheDocument();
    expect(screen.queryByText(/Počty atomů/u)).toBeNull();
    for (const option of choiceOptions()) expect(option).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    const [correct] = choiceOptions();
    if (!correct) throw new Error("missing option");
    fireEvent.click(correct);
    expect(screen.getByText("Správně.")).toBeInTheDocument();
    expect(screen.getByText(/^Celá rovnice:/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Další úloha" }));
    expect(screen.getByText(/^Otázka 2 z/u)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appendAttempt).not.toHaveBeenCalled();
  });

  it("draws the questions in a new order for each start", () => {
    const seeds = [0.1, 0.5, 0.9];
    const firstRoutes = seeds.map((value) => {
      let calls = 0;
      // A different, deterministic sequence per start.
      renderChoice(() => {
        calls += 1;
        return (value * calls * 7.13) % 1;
      });
      const id = document.querySelector("[data-route-id]")?.getAttribute("data-route-id");
      cleanup();
      return id;
    });
    expect(new Set(firstRoutes).size).toBeGreaterThan(1);
  });

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
    renderPractice("Pokročilý");
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
    renderPractice("Profík");
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

  it("evaluates coefficients when randomUUID is unavailable on an HTTP LAN origin", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0);
        return bytes;
      },
    });
    renderPractice();

    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));

    expect(screen.getByText("To není správné řešení.")).toBeInTheDocument();
    expect(appendAttempt.mock.calls[0]?.[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("steps coefficients and recounts the atoms on every change", () => {
    renderPractice();
    const atoms = () => screen.getByRole("table", { name: "Počty atomů" });
    const row = (symbol: string) =>
      within(atoms()).getByRole("rowheader", { name: symbol }).closest("tr") as HTMLTableRowElement;

    expect(row("H")).toHaveTextContent("H12≠ nesouhlasí");
    expect(row("Zn")).toHaveTextContent("Zn11✓ souhlasí");
    expect(screen.getByRole("button", { name: "Snížit koeficient reaktant HCl" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Zvýšit koeficient reaktant HCl" }));

    expect(screen.getByRole("textbox", { name: "Koeficient reaktant HCl" })).toHaveValue("2");
    expect(row("H")).toHaveTextContent("H22✓ souhlasí");
    expect(row("Cl")).toHaveTextContent("Cl22✓ souhlasí");
    fireEvent.click(screen.getByRole("button", { name: "Snížit koeficient reaktant HCl" }));
    expect(screen.getByRole("textbox", { name: "Koeficient reaktant HCl" })).toHaveValue("1");
  });

  it("explains that a balanced entry is not in the lowest ratio", () => {
    renderPractice();
    for (const [name, value] of [
      ["Koeficient reaktant Zn", "2"],
      ["Koeficient reaktant HCl", "4"],
      ["Koeficient produkt H2", "2"],
      ["Koeficient produkt ZnCl2", "2"],
    ] as const) {
      fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));

    expect(screen.getByText("To není správné řešení.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Počty atomů souhlasí, ale koeficienty nejsou v nejmenším celočíselném poměru.",
      ),
    ).toBeInTheDocument();
  });

  it("asks for whole numbers instead of counting unreadable coefficients", () => {
    renderPractice();
    fireEvent.change(screen.getByRole("textbox", { name: "Koeficient reaktant HCl" }), {
      target: { value: "0" },
    });

    expect(screen.queryByRole("table", { name: "Počty atomů" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("celá čísla od 1 do 999");
  });

  it("lets a guest practice without writing attempts", () => {
    auth.role = "guest";
    renderPractice();
    fireEvent.click(screen.getByRole("button", { name: "Vyhodnotit koeficienty" }));
    expect(screen.getByText("To není správné řešení.")).toBeInTheDocument();
    expect(appendAttempt).not.toHaveBeenCalled();
  });
});
