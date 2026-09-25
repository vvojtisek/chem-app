import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Breadcrumbs, PageHeader } from "./page-header";

afterEach(cleanup);

describe("Breadcrumbs", () => {
  it("links every ancestor and marks the last item as the current page", () => {
    render(
      <Breadcrumbs
        items={[{ label: "Procvičovat", href: "/procvicovani" }, { label: "Názvosloví" }]}
      />,
    );

    const trail = screen.getByRole("navigation", { name: "Drobečková navigace" });
    expect(within(trail).getByRole("link", { name: "Procvičovat" })).toHaveAttribute(
      "href",
      "/procvicovani",
    );
    expect(within(trail).queryByRole("link", { name: "Názvosloví" })).toBeNull();
    expect(within(trail).getByText("Názvosloví")).toHaveAttribute("aria-current", "page");
  });
});

describe("PageHeader", () => {
  it("renders one level-one heading with optional description and actions", () => {
    render(
      <PageHeader
        actions={<button type="button">Akce</button>}
        breadcrumbs={[{ label: "Učivo", href: "/uceni/prvky" }, { label: "Příprava a výroba" }]}
        description="Popis obrazovky"
        title="Příprava a výroba látek"
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Příprava a výroba látek");
    expect(screen.getByText("Popis obrazovky")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Akce" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Drobečková navigace" })).toBeInTheDocument();
  });

  it("omits the breadcrumb trail on top-level screens", () => {
    render(<PageHeader title="Pokrok" />);

    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
