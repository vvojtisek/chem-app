import type { PracticeArea } from "./learning-summary";

export interface PracticeLink {
  readonly href: string;
  readonly label: string;
  readonly target?: "_blank";
  /**
   * Label on the home dashboard, where each link starts practice of its area card
   * („Procvičit …“) instead of repeating the exercise name.
   */
  readonly homeLabel?: string;
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
      {
        href: "/procvicovani/prvky",
        label: "Názvy a značky prvků",
        homeLabel: "Procvičit názvy a značky",
      },
      { href: "/flashcards/prvky", label: "Pětiminutový kvíz prvků" },
      {
        href: "/procvicovani/periodicka-tabulka",
        label: "Slepá periodická tabulka",
        homeLabel: "Procvičit pozice",
      },
    ],
  },
  {
    area: "equations",
    title: "Chemické rovnice, příprava a výroba",
    description:
      "Určování produktů reakcí, vyčíslování a kvíz o přípravě a průmyslové výrobě látek.",
    links: [
      {
        href: "/procvicovani/rovnice",
        label: "Vyčíslování rovnic",
        homeLabel: "Procvičit rovnice",
      },
      {
        href: "/procvicovani/priprava-vyroba",
        label: "Příprava a výroba",
        homeLabel: "Kvíz: Příprava a výroba látek",
      },
    ],
  },
  {
    area: "nomenclature",
    title: "Názvosloví",
    description: "Převod mezi českými názvy a chemickými vzorci.",
    links: [
      { href: "/procvicovani/nazvoslovi", label: "Názvosloví", homeLabel: "Procvičit názvosloví" },
    ],
  },
];
