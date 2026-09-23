import {
  ATTEMPT_EVENT_STORE,
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  requestCompleted,
  SYNC_OUTBOX_STORE,
  transactionCompleted,
} from "./browser-learning-database";
import { attemptEventSchema, type NomenclatureAttemptEvent } from "./browser-progress-store";
import {
  isLegacyNomenclatureCheckpoint,
  type NomenclatureCheckpoint,
  nomenclatureCheckpointSchema,
} from "./nomenclature-session";

/** The stored practice is from the older series-based version and cannot be resumed. */
export class LegacyNomenclatureCheckpointError extends Error {
  constructor() {
    super("Uložená série pochází ze starší verze cvičení.");
    this.name = "LegacyNomenclatureCheckpointError";
  }
}

export interface BrowserNomenclatureStore {
  load(): Promise<NomenclatureCheckpoint | null>;
  clear(): Promise<void>;
  /**
   * Stores the checkpoint, or removes it when null (a finished or abandoned practice),
   * together with its attempts in one transaction.
   */
  write(
    checkpoint: NomenclatureCheckpoint | null,
    expectedRevision: number,
    attempts?: readonly NomenclatureAttemptEvent[],
  ): Promise<void>;
}

export function createBrowserNomenclatureStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
  userId?: string,
): BrowserNomenclatureStore {
  return {
    async load() {
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(NOMENCLATURE_SESSION_STORE, "readonly");
        const request = transaction.objectStore(NOMENCLATURE_SESSION_STORE).get("active");
        const value: unknown = await requestCompleted(request);
        await transactionCompleted(transaction);
        if (value === undefined) return null;
        if (isLegacyNomenclatureCheckpoint(value)) throw new LegacyNomenclatureCheckpointError();
        return nomenclatureCheckpointSchema.parse(value);
      } finally {
        database.close();
      }
    },

    async clear() {
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(NOMENCLATURE_SESSION_STORE, "readwrite");
        transaction.objectStore(NOMENCLATURE_SESSION_STORE).delete("active");
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },

    async write(checkpoint, expectedRevision, attempts = []) {
      const valid = checkpoint === null ? null : nomenclatureCheckpointSchema.parse(checkpoint);
      if (valid && valid.revision !== expectedRevision + 1) {
        throw new Error("Nesouhlasí revize uložené série.");
      }
      const validAttempts = attempts.map((attempt) => attemptEventSchema.parse(attempt));
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const stores =
          validAttempts.length > 0
            ? [NOMENCLATURE_SESSION_STORE, ATTEMPT_EVENT_STORE, SYNC_OUTBOX_STORE]
            : [NOMENCLATURE_SESSION_STORE];
        const transaction = database.transaction(stores, "readwrite");
        const completion = transactionCompleted(transaction);
        const sessionStore = transaction.objectStore(NOMENCLATURE_SESSION_STORE);
        let conflict: Error | undefined;
        function save(): void {
          if (valid) sessionStore.put(valid);
          else sessionStore.delete("active");
        }
        function abort(reason: string): void {
          conflict = new Error(reason);
          transaction.abort();
        }
        const currentRequest = sessionStore.get("active");
        currentRequest.onsuccess = () => {
          try {
            const previous: unknown = currentRequest.result;
            const revision =
              previous === undefined || isLegacyNomenclatureCheckpoint(previous)
                ? 0
                : nomenclatureCheckpointSchema.parse(previous).revision;
            if (revision !== expectedRevision) {
              abort("Série byla změněna v jiném okně. Načtěte ji znovu.");
              return;
            }
            if (validAttempts.length === 0) {
              save();
              return;
            }
            const attemptStore = transaction.objectStore(ATTEMPT_EVENT_STORE);
            let checked = 0;
            for (const validAttempt of validAttempts) {
              const attemptRequest = attemptStore.get(validAttempt.id);
              attemptRequest.onsuccess = () => {
                const existing: unknown = attemptRequest.result;
                if (
                  existing !== undefined &&
                  JSON.stringify(existing) !== JSON.stringify(validAttempt)
                ) {
                  abort("Pokus se stejným ID obsahuje jiná data.");
                  return;
                }
                if (existing === undefined) {
                  attemptStore.add(validAttempt);
                  transaction.objectStore(SYNC_OUTBOX_STORE).add({ id: validAttempt.id });
                }
                checked += 1;
                if (checked === validAttempts.length && !conflict) save();
              };
            }
          } catch (error: unknown) {
            conflict = error instanceof Error ? error : new Error("Poškozená uložená série.");
            transaction.abort();
          }
        };
        try {
          await completion;
          if (validAttempts.length > 0 && typeof window !== "undefined")
            window.dispatchEvent(new Event("inorganic:attempt-saved"));
        } catch (error: unknown) {
          throw conflict ?? error;
        }
      } finally {
        database.close();
      }
    },
  };
}
