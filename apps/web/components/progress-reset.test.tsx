import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resetMyProgress = vi.hoisted(() => vi.fn());
const account = vi.hoisted(() => ({
  id: "11111111-1111-4111-8111-111111111111",
  username: "student",
  role: "user" as "user" | "admin" | "tester" | "guest",
  progressGeneration: "00000000-0000-0000-0000-000000000000",
}));
vi.mock("@/lib/api/client", () => ({ resetMyProgress }));
vi.mock("@/components/auth-gate", () => ({
  useAccount: () => account,
  useCapabilities: () => ({ canViewProgress: account.role === "user" || account.role === "admin" }),
}));

import { ProgressReset } from "./progress-reset";

function view() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProgressReset />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  account.role = "user";
  resetMyProgress.mockReset();
});
afterEach(() => cleanup());

describe("progress reset confirmation", () => {
  it("cancellation leaves progress untouched", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Resetovat pokrok" }));
    expect(screen.getByText(/vynulovat celý osobní pokrok/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(screen.getByRole("button", { name: "Resetovat pokrok" })).toBeInTheDocument();
    expect(resetMyProgress).not.toHaveBeenCalled();
  });

  it("calls the API only after explicit confirmation and shows a recoverable failure", async () => {
    resetMyProgress.mockRejectedValue(new Error("network"));
    view();
    expect(resetMyProgress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resetovat pokrok" }));
    expect(resetMyProgress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ano, resetovat pokrok" }));
    await waitFor(() => expect(resetMyProgress).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent("Reset se nepodařilo");
  });

  it.each(["guest", "tester"] as const)("does not offer reset to %s", (role) => {
    account.role = role;
    view();
    expect(screen.queryByRole("button", { name: "Resetovat pokrok" })).toBeNull();
  });
});
