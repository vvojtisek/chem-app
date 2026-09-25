import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEARNING_DATABASE_NAME } from "@/lib/browser-learning-database";
import { createBrowserNomenclatureStore } from "@/lib/browser-nomenclature-store";
import { type AttemptEvent, createBrowserProgressStore } from "@/lib/browser-progress-store";
import {
  DEFAULT_NOMENCLATURE_FILTERS,
  NOMENCLATURE_CHECKPOINT_VERSION,
} from "@/lib/nomenclature-session";

const userId = "11111111-1111-4111-8111-111111111111";
const auth = vi.hoisted(() => ({ role: "user" as "user" | "guest" | "tester" }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth-gate", () => ({
  useAccount: () => ({ id: userId, username: "jana", role: auth.role }),
  useCapabilities: () => ({
    canSave: auth.role !== "guest",
    canViewProgress: auth.role === "user",
  }),
}));

import { HomeDashboard } from "./home-dashboard";

function nomenclatureAttempt(id: number, isCorrect: boolean): AttemptEvent {
  return {
    id: `attempt.${id}`,
    questionId: "nomenclature.nacl.formula-to-name",
    contentVersion: "v1",
    occurredAt: new Date(Date.UTC(2026, 8, 20, 8, id)).toISOString(),
    isCorrect,
    round: "initial",
    mode: "nomenclature",
    eventSchemaVersion: 1,
    sessionId: "session.1",
    sequence: id,
    compoundId: "nomenclature.nacl",
    outcome: isCorrect ? "correct" : "incorrect",
    match: isCorrect ? "canonical" : "none",
    direction: "formula-to-name",
    matchPolicy: "name-lenient",
  };
}

function renderDashboard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HomeDashboard />
    </QueryClientProvider>,
  );
}

function areaCard(title: string): HTMLElement {
  const card = screen.getByRole("heading", { level: 3, name: title }).closest("li");
  if (!card) throw new Error(`No card for ${title}.`);
  return card;
}

beforeEach(() => {
  auth.role = "user";
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(`${LEARNING_DATABASE_NAME}.${userId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
});

describe("HomeDashboard", () => {
  it("shows the accuracy of each area from the answers on this device", async () => {
    const store = createBrowserProgressStore(indexedDB, userId);
    for (const [index, isCorrect] of [true, true, false, true].entries()) {
      await store.appendAttempt(nomenclatureAttempt(index, isCorrect));
    }
    renderDashboard();

    expect(
      await within(areaCard("Názvosloví")).findByText("Úspěšnost 75 % · 4 odpovědi"),
    ).toBeInTheDocument();
    expect(areaCard("Chemické rovnice, výskyt a výroba")).toHaveTextContent("Vyčíslování reakcí");
  });

  it("offers to continue a saved exercise", async () => {
    await createBrowserNomenclatureStore(indexedDB, userId).write(
      {
        id: "active",
        checkpointVersion: NOMENCLATURE_CHECKPOINT_VERSION,
        revision: 1,
        sessionId: "session.1",
        contentVersion: "v1",
        filters: DEFAULT_NOMENCLATURE_FILTERS,
        currentId: "nomenclature.nacl",
        queueIds: [],
        solvedIds: ["nomenclature.agcl"],
        missedIds: [],
        correct: 1,
        incorrect: 0,
        total: 2,
        sequence: 1,
        elapsedMs: 1_000,
      },
      0,
    );
    renderDashboard();

    const resume = await screen.findByRole("region", { name: "Rozpracované cvičení" });
    expect(within(resume).getByRole("link", { name: "Pokračovat: Názvosloví" })).toHaveAttribute(
      "href",
      "/procvicovani/nazvoslovi",
    );
    expect(resume).toHaveTextContent("1 z 2");
  });

  it("keeps guests to the practice areas", async () => {
    auth.role = "guest";
    renderDashboard();

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(areaCard("Názvosloví")).toHaveTextContent("Převod mezi českými názvy");
    expect(screen.queryByRole("region", { name: /Rozpracovan/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "K zopakování" })).toBeNull();
  });
});
