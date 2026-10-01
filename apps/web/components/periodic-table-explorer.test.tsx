import { curatedElements, curatedGroups } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ELEMENT_CATEGORY_OPTIONS } from "@/lib/element-categories";
import { PeriodicTableExplorer } from "./periodic-table-explorer";

beforeAll(() => {
  // jsdom does not implement modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

describe("PeriodicTableExplorer", () => {
  afterEach(cleanup);

  it("lists every shared element category in the legend", () => {
    render(<PeriodicTableExplorer elements={curatedElements} groups={curatedGroups} />);

    const legend = screen.getByRole("list", { name: "Legenda skupin prvků" });
    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(ELEMENT_CATEGORY_OPTIONS.map((category) => category.label));
  });

  it("tints cells and the element dialog by the element's category", () => {
    render(<PeriodicTableExplorer elements={curatedElements} groups={curatedGroups} />);

    const sodium = screen.getByRole("button", { name: /^11\. protonové číslo/u });
    expect(sodium).toHaveAttribute("data-element-category", "alkali-metal");
    expect(screen.getByRole("button", { name: /^9\. protonové číslo/u })).toHaveAttribute(
      "data-element-category",
      "halogen",
    );

    fireEvent.click(sodium);
    const heading = screen.getByRole("heading", { name: "Sodík (Na)" });
    expect(heading.closest("dialog")).toHaveAttribute("data-element-category", "alkali-metal");
  });
});
