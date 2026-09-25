import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredElementCard } from "@/lib/browser-element-card-store";

const storedCards = vi.hoisted(() => new Map<string, StoredElementCard>());

vi.mock("@/lib/browser-element-card-store", () => ({
  createBrowserElementCardStore: () => ({
    list: async () => [...storedCards.values()],
    remove: async (id: string) => {
      storedCards.delete(id);
    },
    upsert: async (card: StoredElementCard) => {
      storedCards.set(card.id, card);
    },
  }),
}));

import { ElementFlashcards } from "./element-flashcards";

const hydrogen: ElementFlashcardData = {
  id: "element.001-h",
  atomicNumber: 1,
  symbol: "H",
  nameCs: "Vodík",
  nameLat: "Hydrogenium",
  period: 1,
  group: 1,
  atomicWeight: 1.008,
  valenceConfiguration: "1s1",
};

const groupOne: ElementGroupData = {
  groupNumber: 1,
  nameCs: "Alkalické kovy",
  mnemonicCs: "Testovací mnemotechnika skupiny 1",
};

afterEach(cleanup);

beforeEach(() => {
  storedCards.clear();
});

describe("ElementFlashcards", () => {
  it("shows the Czech name and the group mnemonic after flipping a card", () => {
    render(<ElementFlashcards curatedElements={[hydrogen]} groups={[groupOne]} />);
    fireEvent.click(screen.getByText("Prohlížet karty prvků"));

    fireEvent.click(screen.getByRole("button", { name: "Otočit kartu" }));

    expect(screen.getByRole("heading", { level: 2, name: "Vodík" })).toBeInTheDocument();
    expect(screen.getByText("Testovací mnemotechnika skupiny 1")).toBeInTheDocument();
  });

  it("saves a local edit and restores the curated card", async () => {
    render(<ElementFlashcards curatedElements={[hydrogen]} groups={[groupOne]} />);
    fireEvent.click(screen.getByText("Prohlížet karty prvků"));

    fireEvent.click(screen.getByRole("button", { name: "Upravit kartu" }));
    fireEvent.change(screen.getByLabelText("Český název"), {
      target: { value: "Vodík — poznámka" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit lokálně" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Lokální úprava byla uložena.");
    });
    expect(storedCards.get(hydrogen.id)?.nameCs).toBe("Vodík — poznámka");

    fireEvent.click(screen.getByRole("button", { name: "Obnovit výchozí" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Výchozí schválená karta byla obnovena.",
      );
    });
    expect(storedCards.has(hydrogen.id)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Otočit kartu" }));
    expect(screen.getByRole("heading", { level: 2, name: "Vodík" })).toBeInTheDocument();
  });
});
