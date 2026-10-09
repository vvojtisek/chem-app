import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PreparationProductionCurriculum } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  get: vi.fn<() => Promise<PreparationProductionCurriculum>>(),
  save: vi.fn(async () => ({ fileSha: "f".repeat(40), pullRequestUrl: "https://example.test/pr" })),
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getPreparationProductionCurriculum: api.get,
  savePreparationProductionProduct: api.save,
}));
vi.mock("@/components/auth-gate", () => ({
  useAccount: () => ({ id: "11111111-1111-4111-8111-111111111111", role: "admin" }),
}));

import { ApiError } from "@/lib/api/client";
import { CurriculumReview } from "./curriculum-review";

const baseSha = "a".repeat(40);

function route(id: string, status: string, formula: string) {
  return {
    id: `preparation-production.route.${id}`,
    sourceId: "id-20-1",
    kind: "preparation",
    reactants: [{ coefficient: 1, formula: "Zn", acceptedAliases: null }],
    products: [{ coefficient: 1, formula, acceptedAliases: null }],
    conditionsCs: null,
    status,
    reviewNote: status === "in-review" ? "Source equation is not atom-balanced." : null,
    reviewedBy: status === "reviewed" ? "reviewer.owner" : null,
    reviewedAt: status === "reviewed" ? "2026-10-09" : null,
    reviewFingerprint: status === "reviewed" ? `sha256:${"c".repeat(64)}` : null,
    reviewEvidence: status === "reviewed" ? "Skripta, str. 3" : null,
    reviewEvidenceConfirmedBy: null,
  };
}

function curriculum(canValidate = true): PreparationProductionCurriculum {
  return {
    contentVersion: "preparation-production-2026-09-24",
    fileSha: baseSha,
    pendingChanges: false,
    pullRequestUrl: null,
    canValidate,
    products: [
      {
        id: "preparation-production.product.vodik",
        nameCs: "Vodík",
        formula: "H2",
        notes: [],
        routes: [route("pending", "owner-approved", "ZnCl2"), route("done", "reviewed", "ZnO")],
        status: "owner-approved",
        author: "Autor",
        sources: [{ title: "Zdroj", locator: "https://example.test/zdroj" }],
        ownerApprovedBy: "Vlastník",
        ownerApprovedAt: "2026-09-24",
        reviewedBy: null,
        reviewedAt: null,
        reviewFingerprint: null,
        reviewEvidence: null,
        reviewEvidenceConfirmedBy: null,
      },
    ],
  };
}

function renderReview() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CurriculumReview />
    </QueryClientProvider>,
  );
}

function routeItem(formula: string): HTMLElement {
  const item = screen.getByRole("img", { name: formula }).closest("li");
  if (!item) throw new Error(`No route with ${formula}.`);
  return item;
}

beforeEach(() => {
  api.get.mockReset();
  api.save.mockClear();
});
afterEach(cleanup);

describe("CurriculumReview", () => {
  it("shows the pending records first, with counts per state", async () => {
    api.get.mockResolvedValue(curriculum());
    renderReview();

    expect(await screen.findByText(/Rovnice: 1 ověřeno · 1 čeká · 0 odebráno/u)).toBeVisible();
    expect(screen.getByRole("button", { name: /Čeká na ověření/u })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("img", { name: "ZnO" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Ověřeno/u }));
    expect(within(routeItem("ZnO")).getByText(/doklad: Skripta, str. 3/u)).toBeVisible();
  });

  it("records a validation with evidence, the fingerprint and the loaded file version", async () => {
    api.get.mockResolvedValue(curriculum());
    renderReview();
    await screen.findByText(/Rovnice:/u);
    const item = routeItem("ZnCl2");

    fireEvent.click(within(item).getByRole("button", { name: "Ověřit" }));
    fireEvent.change(within(item).getByLabelText(/Doklad/u), {
      target: { value: "Skripta, str. 12" },
    });
    fireEvent.change(within(item).getByLabelText(/Potvrdil/u), { target: { value: "Prof. X" } });
    fireEvent.click(within(item).getByRole("button", { name: "Potvrdit ověření" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const [body, sha] = api.save.mock.calls[0] as unknown as [
      { routes: Record<string, unknown>[] },
      string,
    ];
    expect(sha).toBe(baseSha);
    expect(body.routes[0]).toMatchObject({
      status: "reviewed",
      reviewEvidence: "Skripta, str. 12",
      reviewEvidenceConfirmedBy: "Prof. X",
      reviewFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect(body.routes[1]).toMatchObject({ status: "reviewed", reviewEvidence: "Skripta, str. 3" });
    expect(await screen.findByText("Ověření bylo uloženo do pull requestu.")).toBeVisible();
  });

  it("asks for confirmation before removing a record", async () => {
    api.get.mockResolvedValue(curriculum());
    renderReview();
    await screen.findByText(/Rovnice:/u);
    const item = routeItem("ZnCl2");

    fireEvent.click(within(item).getByRole("button", { name: "Odebrat" }));
    expect(api.save).not.toHaveBeenCalled();
    fireEvent.click(within(item).getByRole("button", { name: "Odebrat natrvalo" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const [body] = api.save.mock.calls[0] as unknown as [{ routes: { status: string }[] }];
    expect(body.routes[0]?.status).toBe("deprecated");
  });

  it("hides validation from an admin who is not a registered SME", async () => {
    api.get.mockResolvedValue(curriculum(false));
    renderReview();

    expect(await screen.findByText(/není zapsán jako odborník/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ověřit" })).toBeNull();
    expect(within(routeItem("ZnCl2")).getByRole("button", { name: "Odebrat" })).toBeVisible();
  });

  it("explains how to turn editing on when the server has it disabled", async () => {
    api.get.mockRejectedValue(
      new ApiError(503, "curriculum_editing_disabled", "Editing content is disabled."),
    );
    renderReview();

    expect(await screen.findByRole("alert")).toHaveTextContent("CURRICULUM_GITHUB_TOKEN");
  });

  it("reloads the data when it changed since it was loaded", async () => {
    api.get.mockResolvedValue(curriculum());
    api.save.mockRejectedValueOnce(
      new ApiError(409, "curriculum_changed", "The dataset changed since it was loaded."),
    );
    renderReview();
    await screen.findByText(/Rovnice:/u);

    fireEvent.click(within(routeItem("ZnCl2")).getByRole("button", { name: "Odebrat" }));
    fireEvent.click(screen.getByRole("button", { name: "Odebrat natrvalo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Data se mezitím změnila");
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
