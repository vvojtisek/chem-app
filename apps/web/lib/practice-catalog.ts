export interface PracticeLink {
  readonly href: string;
  readonly label: string;
  readonly target?: "_blank";
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
      { href: "/uceni/prvky", label: "Procházet učivo", target: "_blank" },
      { href: "/flashcards/prvky", label: "Otevřít karty prvků" },
      { href: "/procvicovani/prvky", label: "Procvičit názvy a značky" },
      { href: "/procvicovani/periodicka-tabulka", label: "Procvičit pozice" },
    ],
  },
  {
    title: "Chemické rovnice, výskyt a výroba",
    description: "Vyčíslování reakcí, minerály a postupy přípravy či průmyslové výroby látek.",
    links: [
      { href: "/procvicovani/rovnice", label: "Procvičit rovnice" },
      { href: "/uceni/priprava-vyroba", label: "Procházet výskyt a výrobu" },
    ],
  },
  {
    title: "Názvosloví",
    description: "Převod mezi českými názvy a chemickými vzorci.",
    links: [{ href: "/procvicovani/nazvoslovi", label: "Procvičit názvosloví" }],
  },
];
