import { afterEach, describe, expect, it } from "vitest";

import { LEARNING_DATABASE_NAME } from "./browser-learning-database";
import { createBrowserNomenclatureStore } from "./browser-nomenclature-store";
import { createBrowserPeriodicSessionStore } from "./browser-periodic-session-store";
import {
  DEFAULT_NOMENCLATURE_FILTERS,
  NOMENCLATURE_CHECKPOINT_VERSION,
} from "./nomenclature-session";
import { listResumableExercises } from "./practice-checkpoints";
import {
  PERIODIC_CHECKPOINT_VERSION,
  PERIODIC_NAME_SESSION_ID,
  PERIODIC_POSITION_SESSION_ID,
  type PeriodicCheckpoint,
} from "./periodic-table-session";

const userId = "11111111-1111-4111-8111-111111111111";

function periodicCheckpoint(id: PeriodicCheckpoint["id"]): PeriodicCheckpoint {
  return {
    id,
    checkpointVersion: PERIODIC_CHECKPOINT_VERSION,
    revision: 1,
    contentVersion: "v1",
    selectedIds: ["element.h", "element.he", "element.li"],
    mode: id === PERIODIC_POSITION_SESSION_ID ? "name-to-position" : "symbol-to-name",
    currentId: "element.he",
    queueIds: ["element.li"],
    solvedIds: ["element.h"],
    missedIds: [],
    correct: 1,
    incorrect: 0,
    total: 3,
    elapsedMs: 1_000,
  };
}

afterEach(() => {
  indexedDB.deleteDatabase(`${LEARNING_DATABASE_NAME}.${userId}`);
});

describe("listResumableExercises", () => {
  it("offers nothing when no exercise is saved", async () => {
    expect(await listResumableExercises(indexedDB, userId)).toEqual([]);
  });

  it("lists every saved exercise with its position in the set", async () => {
    await createBrowserNomenclatureStore(indexedDB, userId).write(
      {
        id: "active",
        checkpointVersion: NOMENCLATURE_CHECKPOINT_VERSION,
        revision: 1,
        sessionId: "session.1",
        contentVersion: "v1",
        filters: DEFAULT_NOMENCLATURE_FILTERS,
        currentId: "nomenclature.nacl",
        queueIds: ["nomenclature.kcl"],
        solvedIds: ["nomenclature.agcl"],
        missedIds: ["nomenclature.nacl"],
        correct: 1,
        incorrect: 2,
        total: 3,
        sequence: 3,
        elapsedMs: 4_000,
      },
      0,
    );
    const periodic = createBrowserPeriodicSessionStore(indexedDB, userId);
    await periodic.write(
      PERIODIC_POSITION_SESSION_ID,
      periodicCheckpoint(PERIODIC_POSITION_SESSION_ID),
      0,
    );
    await periodic.write(PERIODIC_NAME_SESSION_ID, periodicCheckpoint(PERIODIC_NAME_SESSION_ID), 0);

    expect(await listResumableExercises(indexedDB, userId)).toEqual([
      {
        kind: "nomenclature",
        title: "Názvosloví",
        detail: "1 správně · 2 špatně",
        href: "/procvicovani/nazvoslovi",
        answered: 1,
        total: 3,
      },
      {
        kind: "periodic-position",
        title: "Slepá periodická tabulka",
        detail: "1 správně · 0 špatně",
        href: "/procvicovani/periodicka-tabulka",
        answered: 1,
        total: 3,
      },
      {
        kind: "periodic-name",
        title: "Názvy a značky prvků",
        detail: "Značka → Název · 1 správně · 0 špatně",
        href: "/procvicovani/prvky",
        answered: 1,
        total: 3,
      },
    ]);
  });
});
