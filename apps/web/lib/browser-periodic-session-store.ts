import {
  ACCOUNT_META_STORE,
  LEARNING_DATABASE_NAME,
  openLearningDatabase,
  PRACTICE_SESSION_STORE,
  requestCompleted,
  transactionCompleted,
} from "./browser-learning-database";
import {
  PERIODIC_NAME_SESSION_ID,
  PERIODIC_POSITION_SESSION_ID,
  type PeriodicCheckpoint,
  periodicCheckpointSchema,
} from "./periodic-table-session";
import { INITIAL_PROGRESS_GENERATION } from "./progress-generation";

/** Copy checkpoints from the former device-wide store once, without removing the source. */
export async function copyLegacyPeriodicCheckpoints(
  indexedDb: IDBFactory,
  userId: string,
  generation: string,
): Promise<void> {
  if (generation !== INITIAL_PROGRESS_GENERATION) return;
  const account = await openLearningDatabase(indexedDb, userId);
  try {
    const check = account.transaction(ACCOUNT_META_STORE, "readonly");
    const completed = transactionCompleted(check);
    const copied = await requestCompleted(
      check.objectStore(ACCOUNT_META_STORE).get("legacy-periodic-copy-v1"),
    );
    await completed;
    if (copied !== undefined) return;
    const known = await indexedDb.databases();
    const values: unknown[] = [];
    if (known.some(({ name }) => name === LEARNING_DATABASE_NAME)) {
      const legacy = await openLearningDatabase(indexedDb);
      try {
        const transaction = legacy.transaction(PRACTICE_SESSION_STORE, "readonly");
        const completed = transactionCompleted(transaction);
        for (const id of [PERIODIC_POSITION_SESSION_ID, PERIODIC_NAME_SESSION_ID]) {
          const value: unknown = await requestCompleted(
            transaction.objectStore(PRACTICE_SESSION_STORE).get(id),
          );
          if (value !== undefined) values.push(value);
        }
        await completed;
      } finally {
        legacy.close();
      }
    }
    const target = account.transaction([ACCOUNT_META_STORE, PRACTICE_SESSION_STORE], "readwrite");
    const completedTarget = transactionCompleted(target);
    const meta = target.objectStore(ACCOUNT_META_STORE);
    const currentGeneration: unknown = await requestCompleted(meta.get("progress-generation"));
    if (
      typeof currentGeneration === "object" &&
      currentGeneration !== null &&
      "value" in currentGeneration &&
      currentGeneration.value !== INITIAL_PROGRESS_GENERATION
    ) {
      target.abort();
      throw new Error("Pokrok se během obnovy starší série změnil.");
    }
    const store = target.objectStore(PRACTICE_SESSION_STORE);
    for (const value of values) {
      if (
        typeof value !== "object" ||
        value === null ||
        !("id" in value) ||
        (value.id !== PERIODIC_POSITION_SESSION_ID && value.id !== PERIODIC_NAME_SESSION_ID)
      )
        continue;
      const existing = await requestCompleted(store.get(value.id));
      if (existing === undefined) store.put(value);
    }
    meta.put({ key: "legacy-periodic-copy-v1", value: true });
    await completedTarget;
  } finally {
    account.close();
  }
}

export interface BrowserPeriodicSessionStore {
  load(id: PeriodicCheckpoint["id"]): Promise<PeriodicCheckpoint | null>;
  write(
    id: PeriodicCheckpoint["id"],
    checkpoint: PeriodicCheckpoint | null,
    expectedRevision: number,
  ): Promise<void>;
  clear(id: PeriodicCheckpoint["id"]): Promise<void>;
}

export function createBrowserPeriodicSessionStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
  userId?: string,
): BrowserPeriodicSessionStore {
  return {
    async load(id) {
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(PRACTICE_SESSION_STORE, "readonly");
        const value: unknown = await requestCompleted(
          transaction.objectStore(PRACTICE_SESSION_STORE).get(id),
        );
        await transactionCompleted(transaction);
        if (value === undefined) return null;
        return periodicCheckpointSchema.parse(value);
      } finally {
        database.close();
      }
    },

    async write(id, checkpoint, expectedRevision) {
      const valid = checkpoint === null ? null : periodicCheckpointSchema.parse(checkpoint);
      if (valid && (valid.id !== id || valid.revision !== expectedRevision + 1)) {
        throw new Error("Nesouhlasí revize uložené série.");
      }
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(PRACTICE_SESSION_STORE, "readwrite");
        const completion = transactionCompleted(transaction);
        const store = transaction.objectStore(PRACTICE_SESSION_STORE);
        let conflict: Error | undefined;
        const request = store.get(id);
        request.onsuccess = () => {
          try {
            const previous: unknown = request.result;
            const revision =
              previous === undefined ? 0 : periodicCheckpointSchema.parse(previous).revision;
            if (revision !== expectedRevision) {
              conflict = new Error("Série byla změněna v jiném okně. Načtěte ji znovu.");
              transaction.abort();
              return;
            }
            if (valid) store.put(valid);
            else store.delete(id);
          } catch (error: unknown) {
            conflict = error instanceof Error ? error : new Error("Poškozená uložená série.");
            transaction.abort();
          }
        };
        try {
          await completion;
        } catch (error: unknown) {
          throw conflict ?? error;
        }
      } finally {
        database.close();
      }
    },

    async clear(id) {
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(PRACTICE_SESSION_STORE, "readwrite");
        transaction.objectStore(PRACTICE_SESSION_STORE).delete(id);
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },
  };
}
