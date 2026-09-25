import { createBrowserNomenclatureStore } from "./browser-nomenclature-store";
import { createBrowserPeriodicSessionStore } from "./browser-periodic-session-store";
import {
  PERIODIC_NAME_SESSION_ID,
  PERIODIC_POSITION_SESSION_ID,
  type PeriodicCheckpoint,
} from "./periodic-table-session";

/** An unfinished exercise saved on this device, as the home screen offers it for resuming. */
export interface ResumableExercise {
  readonly kind: "nomenclature" | "periodic-position" | "periodic-name";
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly answered: number;
  readonly total: number;
}

const NAME_MODE_LABELS: Readonly<
  Record<Exclude<PeriodicCheckpoint["mode"], "name-to-position">, string>
> = {
  "name-to-symbol": "Název → Značka",
  "symbol-to-name": "Značka → Název",
};

function score(checkpoint: { readonly correct: number; readonly incorrect: number }): string {
  return `${checkpoint.correct} správně · ${checkpoint.incorrect} špatně`;
}

/**
 * Reads the saved checkpoints of one account. A checkpoint that cannot be read is left out: the
 * exercise page itself explains the problem and offers the recovery.
 */
export async function listResumableExercises(
  indexedDb: IDBFactory,
  userId: string,
): Promise<readonly ResumableExercise[]> {
  const periodicStore = createBrowserPeriodicSessionStore(indexedDb, userId);
  const [nomenclature, position, names] = await Promise.all([
    createBrowserNomenclatureStore(indexedDb, userId)
      .load()
      .catch(() => null),
    periodicStore.load(PERIODIC_POSITION_SESSION_ID).catch(() => null),
    periodicStore.load(PERIODIC_NAME_SESSION_ID).catch(() => null),
  ]);
  const exercises: ResumableExercise[] = [];
  if (nomenclature) {
    exercises.push({
      kind: "nomenclature",
      title: "Názvosloví",
      detail: score(nomenclature),
      href: "/procvicovani/nazvoslovi",
      answered: nomenclature.solvedIds.length,
      total: nomenclature.total,
    });
  }
  if (position) {
    exercises.push({
      kind: "periodic-position",
      title: "Slepá periodická tabulka",
      detail: score(position),
      href: "/procvicovani/periodicka-tabulka",
      answered: position.solvedIds.length,
      total: position.total,
    });
  }
  if (names) {
    exercises.push({
      kind: "periodic-name",
      title: "Názvy a značky prvků",
      detail: `${names.mode === "name-to-position" ? "" : `${NAME_MODE_LABELS[names.mode]} · `}${score(names)}`,
      href: "/procvicovani/prvky",
      answered: names.solvedIds.length,
      total: names.total,
    });
  }
  return exercises;
}
