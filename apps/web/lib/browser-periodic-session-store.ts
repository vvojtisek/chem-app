import {
  openLearningDatabase,
  PRACTICE_SESSION_STORE,
  requestCompleted,
  transactionCompleted,
} from "./browser-learning-database";
import { type PeriodicCheckpoint, periodicCheckpointSchema } from "./periodic-table-session";

export interface BrowserPeriodicSessionStore {
  load(id: PeriodicCheckpoint["id"]): Promise<PeriodicCheckpoint | null>;
  write(
    id: PeriodicCheckpoint["id"],
    checkpoint: PeriodicCheckpoint | null,
    expectedRevision: number,
  ): Promise<void>;
  clear(id: PeriodicCheckpoint["id"]): Promise<void>;
}

/** Checkpoints live in the device-local database, independently of account attempt history. */
export function createBrowserPeriodicSessionStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
): BrowserPeriodicSessionStore {
  return {
    async load(id) {
      const database = await openLearningDatabase(indexedDb);
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
      const database = await openLearningDatabase(indexedDb);
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
      const database = await openLearningDatabase(indexedDb);
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
