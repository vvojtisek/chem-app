export interface PracticeLink {
  readonly href: string;
  readonly label: string;
}

export interface PracticeCategory {
  readonly title: string;
  readonly description: string;
  readonly links: readonly PracticeLink[];
}

export const practiceCategories: readonly PracticeCategory[] = [
  {
    title: "Periodická tabulka",
    description: "Procvičování značek, názvů a pozic prvků.",
    links: [
      { href: "/flashcards/prvky", label: "Otevřít karty prvků" },
      { href: "/procvicovani/prvky", label: "Procvičit názvy a značky" },
      { href: "/procvicovani/periodicka-tabulka", label: "Procvičit pozice" },
    ],
  },
  {
    title: "Chemické rovnice",
    description: "Vyčíslování a doplňování reaktantů a produktů.",
    links: [],
  },
  {
    title: "Názvosloví",
    description: "Převod mezi českými názvy a chemickými vzorci.",
    links: [{ href: "/procvicovani/nazvoslovi", label: "Procvičit názvosloví" }],
  },
  {
    title: "Výskyt a výroba",
    description: "Minerály, průmyslové procesy a opakovací karty.",
    links: [],
  },
];
