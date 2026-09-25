import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PRACTICE_HUB_HREF, PracticeNavigation } from "./practice-navigation";

afterEach(cleanup);

describe("PracticeNavigation", () => {
  it("offers Zpět to the practice categories and Testy to the dashboard", () => {
    render(<PracticeNavigation backHref={PRACTICE_HUB_HREF} />);
    const navigation = screen.getByRole("navigation", { name: "Navigace procvičování" });

    expect(within(navigation).getByRole("link", { name: /Zpět/ })).toHaveAttribute(
      "href",
      "/procvicovani",
    );
    expect(within(navigation).getByRole("link", { name: /Testy/ })).toHaveAttribute("href", "/");
  });

  it("offers only Testy where there is no level above", () => {
    render(<PracticeNavigation />);

    expect(screen.queryByRole("link", { name: /Zpět/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Testy/ })).toHaveAttribute("href", "/");
  });
});
