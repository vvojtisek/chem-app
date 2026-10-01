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
      { href: "/flashcards/prvky", label: "Pětiminutový kvíz prvků" },
    ],
  },
  {
    area: "equations",
    title: "Chemické rovnice, příprava a výroba",
    description: "Vyčíslování reakcí a kvíz o přípravě a průmyslové výrobě látek.",
    links: [
      { href: "/procvicovani/rovnice", label: "Procvičit rovnice", primary: true },
      { href: "/procvicovani/priprava-vyroba", label: "Kvíz: Příprava a výroba látek" },
    ],
  },
  {
    area: "nomenclature",
    title: "Názvosloví",
    description: "Převod mezi českými názvy a chemickými vzorci.",
    links: [{ href: "/procvicovani/nazvoslovi", label: "Procvičit názvosloví", primary: true }],
  },
];
