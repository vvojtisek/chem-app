import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LEARNING_DATABASE_NAME } from "@/lib/browser-learning-database";
import { type AttemptEvent, createBrowserProgressStore } from "@/lib/browser-progress-store";
import { ELEMENT_SELECTION_KEY } from "@/lib/periodic-table-preferences";

const userId = "22222222-2222-4222-8222-222222222222";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { WeakElements } from "./weak-elements";

function periodic(id: number, questionId: string, isCorrect: boolean): AttemptEvent {
  return {
    id: `attempt.${questionId}.${id}`,
    questionId,
    contentVersion: "v1",
    occurredAt: new Date(Date.UTC(2026, 8, 20, 8, id)).toISOString(),
    isCorrect,
    round: "initial",
    mode: "periodic-table",
    direction: "name-to-position",
    matchPolicy: "exact-position",
  };
}

function renderWeak(emptyText?: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WeakElements userId={userId} {...(emptyText ? { emptyText } : {})} />
    </QueryClientProvider>,
  );
}

afterEach(async () => {
  cleanup();
  push.mockReset();
  localStorage.clear();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(`${LEARNING_DATABASE_NAME}.${userId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
});

describe("WeakElements", () => {
  it("lists weak elements and practises them in the blind table", async () => {
    const store = createBrowserProgressStore(indexedDB, userId);
    const answers: [string, boolean[]][] = [
      ["element.025-mn", [true, false, false]],
      ["element.026-fe", [true, true, true]],
    ];
    let id = 0;
    for (const [questionId, results] of answers) {
      for (const isCorrect of results) {
        await store.appendAttempt(periodic(id++, questionId, isCorrect));
      }
    }
    renderWeak();

    const card = await screen.findByRole("region", { name: "K zopakování" });
    expect(within(card).getByText(/Mangan/)).toBeInTheDocument();
    expect(card).toHaveTextContent("3 pokusy, 1 správně");
    expect(within(card).queryByText(/Železo/)).toBeNull();

    fireEvent.click(
      within(card).getByRole("button", { name: "Procvičit tyto prvky ve slepé tabulce" }),
    );

    expect(JSON.parse(localStorage.getItem(ELEMENT_SELECTION_KEY) ?? "null")).toEqual({
      schemaVersion: 1,
      elementIds: ["element.025-mn"],
    });
    expect(push).toHaveBeenCalledWith("/procvicovani/periodicka-tabulka");
  });

  it("lists the same elements as compact chips", async () => {
    const store = createBrowserProgressStore(indexedDB, userId);
    for (const [index, isCorrect] of [false, false, true].entries()) {
      await store.appendAttempt(periodic(index, "element.025-mn", isCorrect));
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WeakElements compact userId={userId} />
      </QueryClientProvider>,
    );

    const card = await screen.findByRole("region", { name: "K zopakování" });
    expect(within(card).getByRole("listitem")).toHaveTextContent(
      "Mangan (Mn): 3 pokusy, 1 správně",
    );
  });

  it("stays hidden without weak elements unless an empty text is given", async () => {
    renderWeak();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("region", { name: "K zopakování" })).toBeNull();

    cleanup();
    renderWeak("Zatím žádný prvek nepotřebuje opakování.");
    expect(await screen.findByText("Zatím žádný prvek nepotřebuje opakování.")).toBeInTheDocument();
  });
});
