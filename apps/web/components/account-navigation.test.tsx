import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  account: { id: "account-test", role: "user" },
  capabilities: { canSync: false, isGuest: false },
}));

vi.mock("./auth-gate", () => ({
  useAccount: () => hooks.account,
  useCapabilities: () => hooks.capabilities,
}));

import { AccountNavigation } from "./account-navigation";

afterEach(cleanup);

describe("AccountNavigation", () => {
  it("shows all five requested destinations with their existing routes", () => {
    render(<AccountNavigation />);
    const navigation = screen.getByRole("navigation", { name: "Navigace účtu" });
    const destinations = [
      ["Testy", "/"],
      ["Učivo", "/uceni/prvky"],
      ["Statistika", "/pokrok"],
      ["Nápověda", "/napoveda"],
      ["Profil", "/ucet"],
    ] as const;

    for (const [label, href] of destinations) {
      expect(within(navigation).getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(within(navigation).queryByRole("link", { name: "Domů" })).toBeNull();
    expect(within(navigation).queryByRole("link", { name: "Pokrok" })).toBeNull();
  });
});
