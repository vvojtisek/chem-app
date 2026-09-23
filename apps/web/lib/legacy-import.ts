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
  transactionCompleted,
} from "./browser-learning-database";

const stores = [ATTEMPT_EVENT_STORE, ELEMENT_CARD_STORE, NOMENCLATURE_SESSION_STORE] as const;

async function openLegacyDatabase(indexedDb: IDBFactory): Promise<IDBDatabase | null> {
  const known = await indexedDb.databases();
  if (!known.some(({ name }) => name === LEARNING_DATABASE_NAME)) return null;
  const request = indexedDb.open(LEARNING_DATABASE_NAME);
  const database = await requestCompleted(request);
  database.onversionchange = () => database.close();
  return database;
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
    await transactionCompleted(transaction);
    if (decision !== undefined) return null;
  } finally {
    account.close();
  }
  const legacy = await openLegacyDatabase(indexedDb);
  if (!legacy) return null;
  try {
    if (!legacy.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) return 0;
    const transaction = legacy.transaction(ATTEMPT_EVENT_STORE, "readonly");
    const count = await requestCompleted(transaction.objectStore(ATTEMPT_EVENT_STORE).count());
    await transactionCompleted(transaction);
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
  try {
    const present = stores.filter((store) => legacy.objectStoreNames.contains(store));
    const source = legacy.transaction(present, "readonly");
    const values = await Promise.all(
      present.map((store) => requestCompleted<unknown[]>(source.objectStore(store).getAll())),
    );
    await transactionCompleted(source);
    const account = await openLearningDatabase(indexedDb, userId);
    try {
      const target = account.transaction(
        [...stores, SYNC_OUTBOX_STORE, ACCOUNT_META_STORE],
        "readwrite",
      );
      for (const [index, store] of present.entries()) {
        for (const value of values[index] ?? []) {
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
      target.objectStore(ACCOUNT_META_STORE).put({ key: "legacy-import", value: "imported" });
      await transactionCompleted(target);
    } finally {
      account.close();
    }
  } finally {
    legacy.close();
  }
  await resetLearningDatabase(indexedDb);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("inorganic:attempt-saved"));
}
