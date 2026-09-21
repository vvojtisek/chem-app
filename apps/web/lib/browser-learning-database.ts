export const LEARNING_DATABASE_NAME = "inorganic-learning";
export const LEARNING_DATABASE_VERSION = 2;
export const ATTEMPT_EVENT_STORE = "attempt-events";
export const ELEMENT_CARD_STORE = "element-cards";

export async function openLearningDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  try {
    return await openCurrentLearningDatabase(indexedDb);
  } catch (error: unknown) {
    if (!isVersionError(error)) {
      throw error;
    }

    await resetLearningDatabase(indexedDb);
    return openCurrentLearningDatabase(indexedDb);
  }
}

export function resetLearningDatabase(indexedDb: IDBFactory): Promise<void> {
  const request = indexedDb.deleteDatabase(LEARNING_DATABASE_NAME);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB database reset failed."));
    request.onblocked = () =>
      reject(
        new Error(
          "Lokální data nelze obnovit, protože je aplikace otevřená v jiném okně. Zavřete ostatní okna a zkuste to znovu.",
        ),
      );
  });
}

function openCurrentLearningDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  const request = indexedDb.open(LEARNING_DATABASE_NAME, LEARNING_DATABASE_VERSION);

  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) {
      database.createObjectStore(ATTEMPT_EVENT_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(ELEMENT_CARD_STORE)) {
      database.createObjectStore(ELEMENT_CARD_STORE, { keyPath: "id" });
    }
  };

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB database open failed."));
    request.onblocked = () =>
      reject(
        new Error(
          "Lokální data nelze otevřít, protože je aplikace otevřená v jiném okně. Zavřete ostatní okna a zkuste to znovu.",
        ),
      );
  });
}

function isVersionError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "VersionError";
}

export function requestCompleted<Value>(request: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}
