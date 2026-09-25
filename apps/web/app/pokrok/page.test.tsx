import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "user" as "user" | "guest" | "tester",
  getMyAttemptStats: vi.fn(),
  getMyProgression: vi.fn(),
}));

vi.mock("@/components/auth-gate", () => ({
  useAccount: () => ({ id: "account-current", username: "Learner", role: mocks.role }),
  useCapabilities: () => ({ canViewProgress: mocks.role === "user" }),
}));
vi.mock("@/components/periodic-mastery-heatmap", () => ({
  PeriodicMasteryHeatmap: ({ userId }: { userId: string }) => <p>Heatmap for {userId}</p>,
}));
vi.mock("@/components/sync-provider", () => ({ useSync: () => ({ running: false }) }));
vi.mock("@/lib/api/client", () => ({
  getMyAttemptStats: mocks.getMyAttemptStats,
  getMyProgression: mocks.getMyProgression,
}));

import ProgressPage from "./page";

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProgressPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.role = "user";
  mocks.getMyAttemptStats.mockReset();
  mocks.getMyProgression.mockReset();
  mocks.getMyAttemptStats.mockResolvedValue({
    totalAttempts: 3,
    correctAttempts: 2,
    byMode: [{ mode: "periodic-table", totalAttempts: 3, correctAttempts: 2 }],
  });
  mocks.getMyProgression.mockResolvedValue({
    totalAttempts: 3,
    correctAttempts: 2,
    accuracy: 66.7,
    rank: { id: "novice", title: "Začátečník", minimumCorrectAttempts: 0, nextRankAt: 50 },
    trend: [],
  });
});
afterEach(cleanup);

describe("ProgressPage", () => {
  it("shows personal local heatmap and server mode summaries for the active account", async () => {
    renderPage();
    expect(screen.getByText("Heatmap for account-current")).toBeInTheDocument();
    expect(await screen.findByText("3 pokusů · 2 správně")).toBeInTheDocument();
    expect(mocks.getMyAttemptStats).toHaveBeenCalledOnce();
    expect(mocks.getMyProgression).toHaveBeenCalledOnce();
  });

  it.each(["guest", "tester"] as const)("keeps %s outside personal progress", (role) => {
    mocks.role = role;
    renderPage();
    expect(screen.queryByText("Heatmap for account-current")).toBeNull();
    expect(mocks.getMyAttemptStats).not.toHaveBeenCalled();
    expect(mocks.getMyProgression).not.toHaveBeenCalled();
    if (role === "tester") {
      expect(
        screen.getByText("Testovací účet nemá osobní statistiky pokroku."),
      ).toBeInTheDocument();
    } else {
      expect(screen.getByText(/Hostovský přístup/)).toBeInTheDocument();
    }
  });
});
