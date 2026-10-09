import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  pathname: "/",
  account: { id: "account-test", username: "jana", role: "user" } as {
    id: string;
    username: string;
    role: "admin" | "user" | "tester" | "guest";
  },
  capabilities: { canSync: true, isGuest: false },
  logout: vi.fn<() => Promise<void>>(),
  clearAccountMarker: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => hooks.pathname,
  useRouter: () => hooks.router,
}));
vi.mock("@/lib/api/client", () => ({
  logout: hooks.logout,
  getLatestRelease: () => Promise.reject(new Error("not under test")),
}));
vi.mock("@/lib/auth/account-marker", () => ({ clearAccountMarker: hooks.clearAccountMarker }));
vi.mock("./auth-gate", () => ({
  useAccount: () => hooks.account,
  useCapabilities: () => hooks.capabilities,
}));
vi.mock("./sync-provider", () => ({
  SyncStatusChip: () => <span>Synchronizováno</span>,
  useSync: () => ({ quarantineMessage: "" }),
}));

import { AppShell as BareAppShell } from "./app-shell";

function AppShell({ children, notice }: Readonly<{ children: ReactNode; notice?: ReactNode }>) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <BareAppShell notice={notice}>{children}</BareAppShell>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  hooks.logout.mockReset();
  hooks.clearAccountMarker.mockReset();
  hooks.router.replace.mockReset();
  hooks.router.refresh.mockReset();
  hooks.pathname = "/";
  hooks.account = { id: "account-test", username: "jana", role: "user" };
  hooks.capabilities = { canSync: true, isGuest: false };
});

afterEach(cleanup);

function mainNavigation() {
  return screen.getByRole("navigation", { name: "Hlavní navigace" });
}

describe("AppShell", () => {
  it("offers the four primary destinations in one navigation landmark", () => {
    render(<AppShell>obsah</AppShell>);

    const destinations = [
      ["Domů", "/"],
      ["Procvičovat", "/procvicovani"],
      ["Učivo", "/uceni/prvky"],
      ["Pokrok", "/pokrok"],
    ] as const;
    const links = within(mainNavigation()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(destinations.map(([label]) => label));
    for (const [label, href] of destinations) {
      expect(within(mainNavigation()).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getByText("obsah")).toBeInTheDocument();
  });

  it.each([
    ["/", "Domů"],
    ["/procvicovani/nazvoslovi", "Procvičovat"],
    ["/flashcards/prvky", "Procvičovat"],
    ["/uceni/priprava-vyroba", "Učivo"],
    ["/uceni/karty-prvku", "Učivo"],
    ["/pokrok", "Pokrok"],
  ])("marks the destination owning %s as the current page", (pathname, label) => {
    hooks.pathname = pathname;
    render(<AppShell>obsah</AppShell>);

    const current = within(mainNavigation())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("marks no primary destination on help and profile screens", () => {
    hooks.pathname = "/napoveda";
    render(<AppShell>obsah</AppShell>);

    for (const link of within(mainNavigation()).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("links help and profile, and shows the sync status once for a synced account", () => {
    render(<AppShell>obsah</AppShell>);

    for (const link of screen.getAllByRole("link", { name: "Nápověda" })) {
      expect(link).toHaveAttribute("href", "/napoveda");
    }
    for (const link of screen.getAllByRole("link", { name: "Profil" })) {
      expect(link).toHaveAttribute("href", "/ucet");
    }
    expect(screen.getAllByText("Synchronizováno")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Správa" })).toBeNull();
  });

  it("adds the administration link only for administrators", () => {
    hooks.account = { id: "account-admin", username: "admin", role: "admin" };
    render(<AppShell>obsah</AppShell>);

    expect(screen.getByRole("link", { name: "Správa" })).toHaveAttribute("href", "/admin");
  });

  it("labels read-only guests and hides the sync status", () => {
    hooks.account = { id: "guest", username: "host", role: "guest" };
    hooks.capabilities = { canSync: false, isGuest: true };
    render(<AppShell>obsah</AppShell>);

    expect(screen.getByText("Host · jen pro čtení")).toBeInTheDocument();
    expect(screen.queryByText("Synchronizováno")).toBeNull();
  });

  it("labels the tester account", () => {
    hooks.account = { id: "account-tester", username: "tester", role: "tester" };
    render(<AppShell>obsah</AppShell>);

    expect(screen.getByText("Testovací účet")).toBeInTheDocument();
  });

  it("renders a shell-level notice above the page content", () => {
    render(<AppShell notice={<p role="status">Síťové ověření není dostupné.</p>}>obsah</AppShell>);

    expect(screen.getByRole("status")).toHaveTextContent("Síťové ověření není dostupné.");
  });

  it("offers sign-out in both the side rail and the phone top bar", () => {
    render(<AppShell>obsah</AppShell>);

    const buttons = screen.getAllByRole("button", { name: "Odhlásit" });
    expect(buttons).toHaveLength(2);
    expect(buttons.filter((button) => button.className.includes("md:hidden"))).toHaveLength(1);
  });

  it.each([
    ["admin", "Odhlásit"],
    ["tester", "Odhlásit"],
    ["guest", "Ukončit hostovský přístup"],
  ] as const)("offers sign-out to the %s role", (role, label) => {
    hooks.account = { id: `account-${role}`, username: role, role };
    hooks.capabilities = { canSync: role !== "guest", isGuest: role === "guest" };
    render(<AppShell>obsah</AppShell>);

    expect(screen.getAllByRole("button", { name: label })).toHaveLength(2);
  });

  it("ends the server session before forgetting the account and leaving for login", async () => {
    hooks.logout.mockResolvedValue(undefined);
    render(<AppShell>obsah</AppShell>);

    fireEvent.click(screen.getAllByRole("button", { name: "Odhlásit" })[0] as HTMLElement);

    await waitFor(() => expect(hooks.router.replace).toHaveBeenCalledWith("/login"));
    expect(hooks.logout).toHaveBeenCalledTimes(1);
    expect(hooks.clearAccountMarker).toHaveBeenCalledTimes(1);
    expect(hooks.logout.mock.invocationCallOrder[0]).toBeLessThan(
      hooks.clearAccountMarker.mock.invocationCallOrder[0] as number,
    );
  });

  it("keeps the account and reports the failure when the server sign-out fails", async () => {
    hooks.logout.mockRejectedValue(new Error("network"));
    render(<AppShell>obsah</AppShell>);

    fireEvent.click(screen.getAllByRole("button", { name: "Odhlásit" })[1] as HTMLElement);

    expect(await screen.findByRole("alert")).toHaveTextContent("Odhlášení se nepodařilo.");
    expect(hooks.clearAccountMarker).not.toHaveBeenCalled();
    expect(hooks.router.replace).not.toHaveBeenCalled();
  });
});
