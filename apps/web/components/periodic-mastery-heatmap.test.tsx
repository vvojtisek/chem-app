import { curatedElements, curriculumContentVersion } from "@inorganic/content/runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AttemptEvent, createBrowserProgressStore } from "@/lib/browser-progress-store";
import { savePulledAttempts } from "@/lib/sync/sync-store";
import { PeriodicMasteryHeatmap } from "./periodic-mastery-heatmap";

const sync = vi.hoisted(() => ({ running: false }));
vi.mock("./sync-provider", () => ({ useSync: () => sync }));

const hydrogenId = (() => {
  const id = curatedElements.find((element) => element.symbol === "H")?.id;
  if (!id) throw new Error("Reviewed hydrogen element is missing.");
  return id;
})();
const EMPTY_ACCOUNT = "00000000-0000-4000-8000-000000000001";
const OWNER_ACCOUNT = "00000000-0000-4000-8000-000000000002";
const OTHER_ACCOUNT = "00000000-0000-4000-8000-000000000003";
const UNKNOWN_ACCOUNT = "00000000-0000-4000-8000-000000000004";
const SYNC_ACCOUNT = "00000000-0000-4000-8000-000000000005";

function renderHeatmap(userId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <PeriodicMasteryHeatmap userId={userId} />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

function attempt(
  userId: string,
  index: number,
  isCorrect: boolean,
  questionId = hydrogenId,
): AttemptEvent {
  return {
    id: `mastery.${userId}.${index}`,
    questionId,
    contentVersion: curriculumContentVersion,
    occurredAt: new Date(Date.UTC(2026, 8, index, 12)).toISOString(),
    isCorrect,
    round: "initial",
    mode: "periodic-table",
    direction: "name-to-symbol",
    matchPolicy: "symbol-exact",
  };
}

async function saveAttempt(userId: string, index: number, isCorrect: boolean) {
  await createBrowserProgressStore(indexedDB, userId).appendAttempt(
    attempt(userId, index, isCorrect),
  );
}

afterEach(cleanup);
beforeEach(() => {
  sync.running = false;
});

describe("PeriodicMasteryHeatmap", () => {
  it("shows an accessible legend and a distinct no-data state for every element", async () => {
    renderHeatmap(EMPTY_ACCOUNT);
    expect(
      await screen.findByText("Zatím nemáte žádné pokusy z periodické tabulky."),
    ).toBeInTheDocument();
    const legend = screen.getByRole("list", { name: "Legenda zvládnutí" });
    for (const text of ["Bez dat", "Zatím málo pokusů", "K procvičení", "Na cestě", "Zvládnuté"]) {
      expect(within(legend).getByText(text)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("img", { name: "Vodík (H): Bez dat, počet pokusů: 0" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(curatedElements.length);
  });

  it("reads only the active account and refreshes after a local attempt is saved", async () => {
    await saveAttempt(OWNER_ACCOUNT, 1, true);
    renderHeatmap(OTHER_ACCOUNT);
    expect(
      await screen.findByRole("img", { name: "Vodík (H): Bez dat, počet pokusů: 0" }),
    ).toBeInTheDocument();
    await saveAttempt(OTHER_ACCOUNT, 2, true);
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Vodík (H): Zatím málo pokusů, počet pokusů: 1" }),
      ).toBeInTheDocument(),
    );
    await saveAttempt(OTHER_ACCOUNT, 3, true);
    await saveAttempt(OTHER_ACCOUNT, 4, true);
    expect(
      await screen.findByRole("img", { name: "Vodík (H): Zvládnuté, počet pokusů: 3" }),
    ).toBeInTheDocument();
  });

  it("ignores unknown element IDs in the studied count", async () => {
    await createBrowserProgressStore(indexedDB, UNKNOWN_ACCOUNT).appendAttempt(
      attempt(UNKNOWN_ACCOUNT, 10, true, "element.removed"),
    );
    renderHeatmap(UNKNOWN_ACCOUNT);
    expect(
      await screen.findByText("Zatím nemáte žádné pokusy z periodické tabulky."),
    ).toBeInTheDocument();
  });

  it("refreshes after a sync pull even though pulled attempts emit no saved event", async () => {
    const view = renderHeatmap(SYNC_ACCOUNT);
    expect(
      await screen.findByRole("img", { name: "Vodík (H): Bez dat, počet pokusů: 0" }),
    ).toBeInTheDocument();
    sync.running = true;
    view.rerender(
      <QueryClientProvider client={view.client}>
        <PeriodicMasteryHeatmap userId={SYNC_ACCOUNT} />
      </QueryClientProvider>,
    );
    await savePulledAttempts(
      indexedDB,
      SYNC_ACCOUNT,
      [attempt(SYNC_ACCOUNT, 20, true)],
      "cursor-1",
    );
    sync.running = false;
    view.rerender(
      <QueryClientProvider client={view.client}>
        <PeriodicMasteryHeatmap userId={SYNC_ACCOUNT} />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("img", { name: "Vodík (H): Zatím málo pokusů, počet pokusů: 1" }),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error when account storage cannot be opened", async () => {
    renderHeatmap("invalid-account-id");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Místní pokusy se nepodařilo načíst",
    );
  });
});
