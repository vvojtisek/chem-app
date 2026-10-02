import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  pathname: "/soukromi",
  replace: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => hooks.pathname,
  useRouter: () => ({ replace: hooks.replace }),
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  getCurrentUser: hooks.getCurrentUser,
}));
vi.mock("@/lib/sync/sync-store", () => ({
  reconcileProgressGeneration: () => Promise.resolve(),
}));
vi.mock("@/lib/browser-periodic-session-store", () => ({
  copyLegacyPeriodicCheckpoints: () => Promise.resolve(),
}));
vi.mock("./app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));
vi.mock("./sync-provider", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./legacy-import-dialog", () => ({ LegacyImportDialog: () => null }));

import { ApiError } from "@/lib/api/client";
import { AuthGate } from "./auth-gate";

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthGate>
        <h1>Obsah stránky</h1>
      </AuthGate>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  hooks.pathname = "/soukromi";
  hooks.replace.mockReset();
  hooks.getCurrentUser.mockReset();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AuthGate", () => {
  it("shows the privacy notice without the app shell when there is no session", async () => {
    hooks.getCurrentUser.mockRejectedValue(
      new ApiError(401, "unauthorized", "Authentication required."),
    );

    renderGate();

    expect(await screen.findByRole("heading", { name: "Obsah stránky" })).toBeVisible();
    expect(screen.queryByTestId("app-shell")).toBeNull();
    expect(hooks.replace).not.toHaveBeenCalled();
  });

  it("shows the privacy notice offline before any account was verified on the device", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    renderGate();

    expect(await screen.findByRole("heading", { name: "Obsah stránky" })).toBeVisible();
    expect(hooks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("keeps the privacy notice inside the app shell for a signed-in account", async () => {
    hooks.getCurrentUser.mockResolvedValue({
      id: "account-test",
      username: "jana",
      role: "user",
      email: null,
      displayName: null,
      progressGeneration: "generation-1",
    });

    renderGate();

    expect(await screen.findByTestId("app-shell")).toHaveTextContent("Obsah stránky");
  });

  it("redirects other routes to login when there is no session", async () => {
    hooks.pathname = "/procvicovani";
    hooks.getCurrentUser.mockRejectedValue(
      new ApiError(401, "unauthorized", "Authentication required."),
    );

    renderGate();

    await waitFor(() => expect(hooks.replace).toHaveBeenCalledWith("/login?next=%2Fprocvicovani"));
    expect(screen.queryByRole("heading", { name: "Obsah stránky" })).toBeNull();
  });
});
