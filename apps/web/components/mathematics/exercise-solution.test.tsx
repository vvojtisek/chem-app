import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn(), solve: vi.fn() }));

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    status = 0;
  },
  listSubjects: api.list,
  solveSubjectProblem: api.solve,
}));
vi.mock("./math-text", () => ({
  MathText: ({ children }: Readonly<{ children: string }>) => <span>{children}</span>,
}));
vi.mock("@/components/subject-workspace", () => ({
  SolutionView: ({ solution }: Readonly<{ solution: { resultLatex: string } }>) => (
    <p>SymPy: {solution.resultLatex}</p>
  ),
}));

import type { MathExercise } from "@inorganic/content/higher-mathematics";
import { ExerciseSolution } from "./exercise-solution";

const exercise: MathExercise = {
  id: "math.test.limit",
  prompt: "Vypočtěte limitu.",
  answer: "2",
  hints: ["Rozložte."],
  solutionSteps: ["Rozložíme čitatele.", "Zkrátíme.", "Dosadíme $x=1$."],
  solver: {
    problemType: "limit",
    values: { expression: "(x^2-1)/(x-1)", variable: "x", point: "1" },
  },
};

function renderSolution(item: MathExercise) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExerciseSolution exercise={item} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExerciseSolution", () => {
  it("shows the solver's verified steps for a linked exercise", async () => {
    api.list.mockResolvedValue([{ id: "matematika", problemTypes: [] }]);
    api.solve.mockResolvedValue({ resultLatex: "2", steps: [] });
    renderSolution(exercise);

    expect(await screen.findByText("SymPy: 2")).toBeInTheDocument();
    expect(api.solve).toHaveBeenCalledWith("matematika", {
      problemType: "limit",
      values: { expression: "(x^2-1)/(x-1)", variable: "x", point: "1" },
    });
  });

  it("reveals the authored steps one by one, then the result", () => {
    const { solver: _unused, ...plain } = exercise;
    renderSolution(plain);
    expect(screen.getByText("Rozložíme čitatele.")).toBeVisible();
    expect(screen.queryByText("Zkrátíme.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Další krok (2/3)" }));
    expect(screen.getByText("Zkrátíme.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Celé řešení" }));
    expect(screen.getByText("Dosadíme $x=1$.")).toBeVisible();
    expect(screen.getByText(/Výsledek/)).toBeVisible();
    expect(api.solve).not.toHaveBeenCalled();
  });

  it("falls back to the authored steps when the solver fails", async () => {
    api.list.mockResolvedValue([{ id: "matematika", problemTypes: [] }]);
    api.solve.mockRejectedValue(new Error("down"));
    renderSolution(exercise);
    await waitFor(() =>
      expect(screen.getByText(/Výpočet se nepodařilo načíst/)).toBeInTheDocument(),
    );
    expect(screen.getByText("Rozložíme čitatele.")).toBeVisible();
  });
});
