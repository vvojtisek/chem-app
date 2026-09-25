import type { PracticeArea } from "./learning-summary";

export interface PracticeLink {
  readonly href: string;
  readonly label: string;
  readonly target?: "_blank";
  /** The one main action of the area, shown as the filled button. */
  readonly primary?: true;
}

export interface PracticeCategory {
  readonly area: PracticeArea;
  readonly title: string;
  readonly description: string;
  readonly links: readonly PracticeLink[];
}

export const practiceCategories: readonly PracticeCategory[] = [
  {
    area: "periodic",
    title: "Periodická tabulka",
    description: "Procvičování značek, názvů a pozic prvků.",
    links: [
      { href: "/procvicovani/periodicka-tabulka", label: "Procvičit pozice", primary: true },
      { href: "/procvicovani/prvky", label: "Procvičit názvy a značky" },
      { href: "/flashcards/prvky", label: "Otevřít karty prvků" },
      { href: "/uceni/prvky", label: "Procházet učivo", target: "_blank" },
    ],
  },
  {
    area: "equations",
    title: "Chemické rovnice, výskyt a výroba",
    description: "Vyčíslování reakcí, minerály a postupy přípravy či průmyslové výroby látek.",
    links: [
      { href: "/procvicovani/rovnice", label: "Procvičit rovnice", primary: true },
      { href: "/uceni/priprava-vyroba", label: "Procházet výskyt a výrobu" },
    ],
  },
  {
    area: "nomenclature",
    title: "Názvosloví",
    description: "Převod mezi českými názvy a chemickými vzorci.",
    links: [{ href: "/procvicovani/nazvoslovi", label: "Procvičit názvosloví", primary: true }],
  },
];
