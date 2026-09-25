import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  pathname: "/",
  account: { id: "account-test", username: "jana", role: "user" } as {
    id: string;
    username: string;
    role: "admin" | "user" | "tester" | "guest";
  },
  capabilities: { canSync: true, isGuest: false },
}));

vi.mock("next/navigation", () => ({ usePathname: () => hooks.pathname }));
vi.mock("./auth-gate", () => ({
  useAccount: () => hooks.account,
  useCapabilities: () => hooks.capabilities,
}));
vi.mock("./sync-provider", () => ({
  SyncStatusChip: () => <span>Synchronizováno</span>,
  useSync: () => ({ quarantineMessage: "" }),
}));

import { AppShell } from "./app-shell";

beforeEach(() => {
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
});
