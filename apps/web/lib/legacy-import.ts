import {
  ACCOUNT_META_STORE,
  ATTEMPT_EVENT_STORE,
  ELEMENT_CARD_STORE,
  LEARNING_DATABASE_NAME,
  NOMENCLATURE_SESSION_STORE,
  openLearningDatabase,
  requestCompleted,
  resetLearningDatabase,
  SYNC_OUTBOX_STORE,
  SYNC_QUARANTINE_STORE,
  transactionCompleted,
} from "./browser-learning-database";
import { PERIODIC_NAME_SESSION_ID, PERIODIC_POSITION_SESSION_ID } from "./periodic-table-session";
import { INITIAL_PROGRESS_GENERATION } from "./progress-generation";

const stores = [ATTEMPT_EVENT_STORE, ELEMENT_CARD_STORE, NOMENCLATURE_SESSION_STORE] as const;

async function openLegacyDatabase(indexedDb: IDBFactory): Promise<IDBDatabase | null> {
  const known = await indexedDb.databases();
  if (!known.some(({ name }) => name === LEARNING_DATABASE_NAME)) return null;
  return openLearningDatabase(indexedDb);
}

export async function legacyAttemptCount(
  indexedDb: IDBFactory,
  userId: string,
): Promise<number | null> {
  const account = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = account.transaction(ACCOUNT_META_STORE, "readonly");
    const decision = await requestCompleted(
      transaction.objectStore(ACCOUNT_META_STORE).get("legacy-import"),
    );
    const generation: unknown = await requestCompleted(
      transaction.objectStore(ACCOUNT_META_STORE).get("progress-generation"),
    );
    await transactionCompleted(transaction);
    if (
      typeof generation === "object" &&
      generation !== null &&
      "value" in generation &&
      generation.value !== INITIAL_PROGRESS_GENERATION
    )
      return null;
    if (decision !== undefined) return null;
  } finally {
    account.close();
  }
  const legacy = await openLegacyDatabase(indexedDb);
  if (!legacy) return null;
  try {
    if (!legacy.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) return 0;
    const transaction = legacy.transaction(stores, "readonly");
    const [count, cardCount, oldSession] = await Promise.all([
      requestCompleted(transaction.objectStore(ATTEMPT_EVENT_STORE).count()),
      requestCompleted(transaction.objectStore(ELEMENT_CARD_STORE).count()),
      requestCompleted(transaction.objectStore(NOMENCLATURE_SESSION_STORE).get("active")),
    ]);
    await transactionCompleted(transaction);
    // A periodic-table checkpoint uses the old device database but is not legacy account data.
    if (count === 0 && cardCount === 0 && oldSession === undefined) return null;
    return count;
  } finally {
    legacy.close();
  }
}

export async function keepLegacyOutsideAccount(
  indexedDb: IDBFactory,
  userId: string,
): Promise<void> {
  const account = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = account.transaction(ACCOUNT_META_STORE, "readwrite");
    transaction.objectStore(ACCOUNT_META_STORE).put({ key: "legacy-import", value: "declined" });
    await transactionCompleted(transaction);
  } finally {
    account.close();
  }
}

export async function importLegacyData(indexedDb: IDBFactory, userId: string): Promise<void> {
  const legacy = await openLegacyDatabase(indexedDb);
  if (!legacy) return;
  let hasPeriodicCheckpoints = false;
  try {
    const present = stores.filter((store) => legacy.objectStoreNames.contains(store));
    const source = legacy.transaction(present, "readonly");
    const values = await Promise.all(
      present.map((store) => requestCompleted<unknown[]>(source.objectStore(store).getAll())),
    );
    await transactionCompleted(source);
    hasPeriodicCheckpoints =
      values[present.indexOf(NOMENCLATURE_SESSION_STORE)]?.some(isPeriodicCheckpoint) ?? false;
    const account = await openLearningDatabase(indexedDb, userId);
    try {
      const target = account.transaction(
        [...stores, SYNC_OUTBOX_STORE, ACCOUNT_META_STORE],
        "readwrite",
      );
      const completed = transactionCompleted(target);
      let resetError: Error | null = null;
      const meta = target.objectStore(ACCOUNT_META_STORE);
      const generationRequest = meta.get("progress-generation");
      generationRequest.onsuccess = () => {
        const generation: unknown = generationRequest.result;
        if (
          typeof generation === "object" &&
          generation !== null &&
          "value" in generation &&
          generation.value !== INITIAL_PROGRESS_GENERATION
        ) {
          resetError = new Error("Staré pokusy nelze importovat po resetu pokroku účtu.");
          target.abort();
          return;
        }
        for (const [index, store] of present.entries()) {
          for (const value of values[index] ?? []) {
            if (store === NOMENCLATURE_SESSION_STORE && isPeriodicCheckpoint(value)) continue;
            target.objectStore(store).add(value);
            if (
              store === ATTEMPT_EVENT_STORE &&
              typeof value === "object" &&
              value !== null &&
              "id" in value &&
              typeof value.id === "string"
            ) {
              target.objectStore(SYNC_OUTBOX_STORE).add({ id: value.id });
            }
          }
        }
        meta.put({ key: "legacy-import", value: "imported" });
      };
      try {
        await completed;
      } catch (error) {
        throw resetError ?? error;
      }
    } finally {
      account.close();
    }
  } finally {
    legacy.close();
  }
  if (!hasPeriodicCheckpoints) {
    await resetLearningDatabase(indexedDb);
  } else {
    // Preserve active device-local periodic practices while removing imported account data.
    const database = await openLearningDatabase(indexedDb);
    try {
      const transaction = database.transaction(
        [
          ATTEMPT_EVENT_STORE,
          ELEMENT_CARD_STORE,
          NOMENCLATURE_SESSION_STORE,
          SYNC_OUTBOX_STORE,
          SYNC_QUARANTINE_STORE,
        ],
        "readwrite",
      );
      transaction.objectStore(ATTEMPT_EVENT_STORE).clear();
      transaction.objectStore(ELEMENT_CARD_STORE).clear();
      transaction.objectStore(NOMENCLATURE_SESSION_STORE).delete("active");
      transaction.objectStore(SYNC_OUTBOX_STORE).clear();
      transaction.objectStore(SYNC_QUARANTINE_STORE).clear();
      await transactionCompleted(transaction);
    } finally {
      database.close();
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("inorganic:attempt-saved"));
}

function isPeriodicCheckpoint(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    (value.id === PERIODIC_POSITION_SESSION_ID || value.id === PERIODIC_NAME_SESSION_ID)
  );
}
