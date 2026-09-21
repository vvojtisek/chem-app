export const LEARNING_DATABASE_NAME = "inorganic-learning";
export const LEARNING_DATABASE_VERSION = 3;
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
    request.onerror = () => reject(request.error ?? new Error("IndexedDB database reset failed."));
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

  request.onupgradeneeded = (event) => {
    const database = request.result;
    if (!database.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) {
      database.createObjectStore(ATTEMPT_EVENT_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(ELEMENT_CARD_STORE)) {
      database.createObjectStore(ELEMENT_CARD_STORE, { keyPath: "id" });
    }
    if (event.oldVersion < 3 && database.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) {
      migrateAttemptEvents(request.transaction?.objectStore(ATTEMPT_EVENT_STORE));
    }
  };

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB database open failed."));
    request.onblocked = () =>
      reject(
        new Error(
          "Lokální data nelze otevřít, protože je aplikace otevřená v jiném okně. Zavřete ostatní okna a zkuste to znovu.",
        ),
      );
  });
}

function migrateAttemptEvents(store: IDBObjectStore | undefined): void {
  if (!store) return;

  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;

    if (isLegacyAttemptEvent(cursor.value)) {
      cursor.update({
        ...cursor.value,
        round: "initial",
        mode: "element-name",
        direction: "symbol-to-name",
        matchPolicy: "diacritics-tolerant",
      });
    }
    cursor.continue();
  };
}

function isLegacyAttemptEvent(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.questionId === "string" &&
    typeof candidate.contentVersion === "string" &&
    typeof candidate.occurredAt === "string" &&
    typeof candidate.isCorrect === "boolean" &&
    !("round" in candidate)
  );
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
