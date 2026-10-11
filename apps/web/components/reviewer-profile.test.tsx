import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurriculumReviewerProfile } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  get: vi.fn<() => Promise<CurriculumReviewerProfile>>(),
  update:
    vi.fn<
      (body: { publicName: string; qualification: string }) => Promise<CurriculumReviewerProfile>
    >(),
}));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getCurriculumReviewerProfile: api.get,
  updateCurriculumReviewerProfile: api.update,
}));

import { ReviewerProfile } from "./reviewer-profile";

const empty: CurriculumReviewerProfile = {
  reviewerId: null,
  publicName: null,
  qualification: null,
  managedByConfiguration: false,
};

function renderProfile() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReviewerProfile />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.get.mockReset();
  api.update.mockReset();
});
afterEach(cleanup);

describe("ReviewerProfile", () => {
  it("asks an SME without a profile to fill in the public name and qualification", async () => {
    api.get.mockResolvedValue(empty);
    api.update.mockImplementation(async (body) => ({
      ...body,
      reviewerId: "reviewer.account-0123456789ab",
      managedByConfiguration: false,
    }));
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Vyplnit profil" }));
    const form = screen.getByRole("form", { name: "Profil odborníka" });
    expect(form).toHaveTextContent("Repozitář je veřejný");
    fireEvent.change(screen.getByLabelText("Jméno (veřejné)"), { target: { value: "Jana" } });
    fireEvent.change(screen.getByLabelText("Kvalifikace (veřejná)"), {
      target: { value: "Ph.D." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit profil" }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({ publicName: "Jana", qualification: "Ph.D." }),
    );
    const edit = await screen.findByRole("button", { name: "Upravit profil" });
    expect(edit.closest("p")).toHaveTextContent("Ověřujete jako Jana (Ph.D.)");
  });

  it("shows nothing for an account whose reviewer entry is configured on the server", async () => {
    api.get.mockResolvedValue({
      ...empty,
      reviewerId: "reviewer.vvojtisek",
      managedByConfiguration: true,
    });
    renderProfile();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Vyplnit profil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Upravit profil" })).toBeNull();
  });
});
