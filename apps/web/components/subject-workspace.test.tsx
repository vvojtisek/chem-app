import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Subject, SubjectProblemType, SubjectSolution } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  preview: vi.fn(async () => ({ fields: {} })),
  solve: vi.fn(),
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  listSubjects: api.list,
  previewSubjectInput: api.preview,
  solveSubjectProblem: api.solve,
}));
vi.mock("@/components/auth-gate", () => ({ useCapabilities: () => ({ isGuest: false }) }));

import { initialValues, requestValues, SubjectWorkspace } from "./subject-workspace";

const derivative: SubjectProblemType = {
  id: "derivative",
  label: "Derivace",
  description: "Derivace funkce jedné proměnné.",
  example: { expression: "x^2*sin(x)" },
  fields: [
    {
      name: "expression",
      label: "Funkce f(x)",
      kind: "expression",
      required: true,
      placeholder: "x^2*sin(x)",
      help: "",
      default: null,
      options: [],
    },
    {
      name: "order",
      label: "Řád",
      kind: "choice",
      required: false,
      placeholder: "",
      help: "",
      default: "1",
      options: [
        { value: "1", label: "1." },
        { value: "2", label: "2." },
      ],
    },
    {
      name: "variable",
      label: "Proměnná",
      kind: "variable",
      required: false,
      placeholder: "x",
      help: "",
      default: null,
      options: [],
    },
  ],
};

const subject: Subject = {
  id: "matematika",
  label: "Matematika",
  description: "Limity, derivace a integrály.",
  problemTypes: [derivative],
  exportFormats: ["svg"],
  renderingEnabled: false,
  explanationsEnabled: false,
};

const solution: SubjectSolution = {
  subjectId: "matematika",
  problemType: "derivative",
  problemLatex: "\\frac{d}{dx} x^{2}",
  resultLatex: "2 x",
  verifiedBy: "sympy.diff",
  notes: [],
  scene: null,
  steps: [
    {
      rule: "power",
      title: "Mocninné pravidlo",
      before: "x^{2}",
      after: "2 x",
      justification: "(x^n)' = n x^{n-1}",
      rewritten: null,
      substeps: [],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderWorkspace(initialTypeId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SubjectWorkspace initialTypeId={initialTypeId} subjectId="matematika" />
    </QueryClientProvider>,
  );
}

describe("subject form values", () => {
  it("starts from the example, then the field default", () => {
    expect(initialValues(derivative)).toEqual({
      expression: "x^2*sin(x)",
      order: "1",
      variable: "",
    });
  });

  it("drops empty optional fields and trims the rest", () => {
    expect(requestValues(derivative, { expression: " x^3 ", order: "2", variable: " " })).toEqual({
      expression: "x^3",
      order: "2",
    });
  });
});

describe("SubjectWorkspace", () => {
  it("solves the example and shows the verified steps", async () => {
    api.list.mockResolvedValue([subject]);
    api.solve.mockResolvedValue(solution);
    renderWorkspace();

    const input = await screen.findByLabelText("Funkce f(x)");
    expect(input).toHaveValue("x^2*sin(x)");
    fireEvent.change(input, { target: { value: "x^2" } });
    fireEvent.click(screen.getByRole("button", { name: /Vyřešit/ }));

    await waitFor(() =>
      expect(api.solve).toHaveBeenCalledWith("matematika", {
        problemType: "derivative",
        values: { expression: "x^2", order: "1" },
      }),
    );
    expect(await screen.findByText("Mocninné pravidlo")).toBeInTheDocument();
    expect(screen.getByText(/sympy\.diff/)).toBeInTheDocument();
  });

  it("reports an unknown subject", async () => {
    api.list.mockResolvedValue([]);
    renderWorkspace();
    expect(await screen.findByRole("alert")).toHaveTextContent("Předmět neexistuje.");
  });
});

describe("SubjectWorkspace type switching", () => {
  it("drops a solve that finishes after the learner switched problem type", async () => {
    const limit: SubjectProblemType = {
      ...derivative,
      id: "limit",
      label: "Limita",
      example: { expression: "(1 - cos(x))/x^2" },
    };
    api.list.mockResolvedValue([{ ...subject, problemTypes: [limit, derivative] }]);
    let finish: (value: SubjectSolution) => void = () => undefined;
    api.solve.mockReturnValue(
      new Promise<SubjectSolution>((resolve) => {
        finish = resolve;
      }),
    );
    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "Vyřešit" }));
    expect(await screen.findByRole("button", { name: "Počítám…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Derivace" }));
    expect(screen.getByRole("button", { name: "Vyřešit" })).toBeEnabled();

    finish({ ...solution, problemType: "limit", verifiedBy: "sympy.limit" });
    await waitFor(() => expect(api.solve).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/sympy\.limit/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Derivace" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Funkce f(x)")).toHaveValue("x^2*sin(x)");
  });
});

describe("SubjectWorkspace preselected type", () => {
  const limit: SubjectProblemType = {
    ...derivative,
    id: "limit",
    label: "Limita",
    example: { expression: "(1 - cos(x))/x^2" },
  };

  it("opens the problem type named by ?typ= from a practice section", async () => {
    api.list.mockResolvedValue([{ ...subject, problemTypes: [derivative, limit] }]);
    renderWorkspace("limit");
    expect(await screen.findByRole("button", { name: "Limita" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Funkce f(x)")).toHaveValue("(1 - cos(x))/x^2");
  });

  it("falls back to the first type for an unknown value", async () => {
    api.list.mockResolvedValue([{ ...subject, problemTypes: [derivative, limit] }]);
    renderWorkspace("neexistuje");
    expect(await screen.findByRole("button", { name: "Derivace" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
