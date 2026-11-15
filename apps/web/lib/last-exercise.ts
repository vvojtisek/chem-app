import type { AttemptEvent } from "./browser-progress-store";

export interface LastExercise {
  readonly title: string;
  readonly href: string;
  readonly occurredAt: string;
}

function exerciseOf(attempt: AttemptEvent): Omit<LastExercise, "occurredAt"> {
  switch (attempt.mode) {
    case "periodic-table":
      return attempt.direction === "name-to-position"
        ? { title: "Slepá periodická tabulka", href: "/procvicovani/periodicka-tabulka" }
        : { title: "Názvy a značky prvků", href: "/procvicovani/prvky" };
    case "element-name":
      return { title: "Názvy a značky prvků", href: "/procvicovani/prvky" };
    case "nomenclature":
      return { title: "Názvosloví", href: "/procvicovani/nazvoslovi" };
    case "equation":
      return { title: "Vyčíslování rovnic", href: "/procvicovani/rovnice" };
  }
}

/**
 * The exercise of the newest attempt on this device. The periodic and nomenclature exercises
 * remember their selection, so opening them again offers the last round's settings.
 */
export function findLastExercise(attempts: readonly AttemptEvent[]): LastExercise | null {
  let latest: AttemptEvent | undefined;
  for (const attempt of attempts) {
    if (
      !latest ||
      attempt.occurredAt > latest.occurredAt ||
      (attempt.occurredAt === latest.occurredAt && attempt.id > latest.id)
    )
      latest = attempt;
  }
  return latest ? { ...exerciseOf(latest), occurredAt: latest.occurredAt } : null;
}
