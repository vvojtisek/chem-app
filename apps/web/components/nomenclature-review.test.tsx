import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import nomenclature from "../../../content/data/nomenclature.json";
import type { NomenclatureCurriculum } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  get: vi.fn<() => Promise<NomenclatureCurriculum>>(),
  save: vi.fn(async () => ({ fileSha: "f".repeat(40), pullRequestUrl: "https://example.test/pr" })),
}));
const auth = vi.hoisted(() => ({ role: "admin" }));

vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getNomenclatureCurriculum: api.get,
  saveNomenclatureRecord: api.save,
  getPreparationProductionCurriculum: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/components/auth-gate", () => ({
  useAccount: () => ({ id: "11111111-1111-4111-8111-111111111111", role: auth.role }),
}));

import { AdminData } from "./admin-data";

const baseSha = "a".repeat(40);
const records = nomenclature.records as unknown as NomenclatureCurriculum["records"];
const draft = records.find((record) => record.status === "draft");
const published = records[0];
if (!draft || !published) throw new Error("fixture");

function curriculum(canValidate = true): NomenclatureCurriculum {
  return {
    records: [published, draft] as NomenclatureCurriculum["records"],
    fileSha: baseSha,
    pendingChanges: false,
    pullRequestUrl: null,
    canValidate,
  };
}

async function openNomenclature() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminData />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Názvosloví" }));
  await screen.findByText(/Záznamy:/u);
}

function recordItem(name: string): HTMLElement {
  const item = screen.getByRole("heading", { name: new RegExp(name, "u") }).closest("li");
  if (!item) throw new Error(`No record ${name}.`);
  return item;
}

beforeEach(() => {
  auth.role = "admin";
  api.get.mockReset();
  api.save.mockClear();
});
afterEach(cleanup);

describe("Nomenclature review", () => {
  it("switches to nomenclature and shows pending records with counts", async () => {
    api.get.mockResolvedValue(curriculum());
    await openNomenclature();

    expect(screen.getByText(/0 ověřeno · 1 čeká · 1 nepublikováno · 0 odebráno/u)).toBeVisible();
    expect(recordItem(published.nameCs)).toBeVisible();
    expect(screen.queryByRole("heading", { name: new RegExp(draft.nameCs, "u") })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Nepublikováno/u }));
    const item = recordItem(draft.nameCs);
    expect(within(item).getByText(/Studenti tento záznam nevidí/u)).toBeVisible();
    expect(within(item).queryByRole("button", { name: "Ověřit" })).toBeNull();
  });

  it("saves a validation with the record, its fingerprint and the rebuilt snapshot", async () => {
    api.get.mockResolvedValue(curriculum());
    await openNomenclature();
    const item = recordItem(published.nameCs);

    fireEvent.click(within(item).getByRole("button", { name: "Ověřit" }));
    fireEvent.change(within(item).getByLabelText(/Doklad/u), {
      target: { value: "Skripta, s. 40" },
    });
    fireEvent.click(within(item).getByRole("button", { name: "Potvrdit ověření" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const [body, sha] = api.save.mock.calls[0] as unknown as [
      {
        record: Record<string, unknown>;
        runtimeSnapshot: { compounds: { id: string; reviewLevel: string }[] };
      },
      string,
    ];
    expect(sha).toBe(baseSha);
    expect(body.record).toMatchObject({
      id: published.id,
      status: "reviewed",
      reviewEvidence: "Skripta, s. 40",
      reviewFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    expect(body.runtimeSnapshot.compounds).toEqual([
      expect.objectContaining({ id: published.id, reviewLevel: "sme-reviewed" }),
    ]);
    expect(await screen.findByText("Ověření bylo uloženo do pull requestu.")).toBeVisible();
  });

  it("asks before removing and hides validation from an admin who is not an SME", async () => {
    api.get.mockResolvedValue(curriculum(false));
    await openNomenclature();
    const item = recordItem(published.nameCs);

    expect(within(item).queryByRole("button", { name: "Ověřit" })).toBeNull();
    fireEvent.click(within(item).getByRole("button", { name: "Odebrat" }));
    expect(api.save).not.toHaveBeenCalled();
    fireEvent.click(within(item).getByRole("button", { name: "Odebrat natrvalo" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const [body] = api.save.mock.calls[0] as unknown as [
      { record: { status: string }; runtimeSnapshot: { compounds: unknown[] } },
    ];
    expect(body.record.status).toBe("deprecated");
    expect(body.runtimeSnapshot.compounds).toEqual([]);
  });

  it("denies the data screen to non-admins", () => {
    auth.role = "user";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminData />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Přístup odepřen" })).toBeVisible();
    expect(api.get).not.toHaveBeenCalled();
  });
});
