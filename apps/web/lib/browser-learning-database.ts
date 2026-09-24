export const LEARNING_DATABASE_NAME = "inorganic-learning";
export const LEARNING_DATABASE_VERSION = 6;
export const ATTEMPT_EVENT_STORE = "attempt-events";
export const ELEMENT_CARD_STORE = "element-cards";
export const NOMENCLATURE_SESSION_STORE = "nomenclature-sessions";
export const SYNC_OUTBOX_STORE = "sync-outbox";
export const SYNC_QUARANTINE_STORE = "sync-quarantine";
export const ACCOUNT_META_STORE = "account-meta";

export function accountDatabaseName(userId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(userId)) {
    throw new Error("Neplatný identifikátor účtu.");
  }
  return `${LEARNING_DATABASE_NAME}.${userId}`;
}

export async function openLearningDatabase(
  indexedDb: IDBFactory,
  userId?: string,
): Promise<IDBDatabase> {
  return openCurrentLearningDatabase(
    indexedDb,
    userId ? accountDatabaseName(userId) : LEARNING_DATABASE_NAME,
  );
}

export function resetLearningDatabase(indexedDb: IDBFactory, userId?: string): Promise<void> {
  const request = indexedDb.deleteDatabase(
    userId ? accountDatabaseName(userId) : LEARNING_DATABASE_NAME,
  );

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

function openCurrentLearningDatabase(indexedDb: IDBFactory, name: string): Promise<IDBDatabase> {
  const request = indexedDb.open(name, LEARNING_DATABASE_VERSION);

  request.onupgradeneeded = (event) => {
    const database = request.result;
    if (!database.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) {
      database.createObjectStore(ATTEMPT_EVENT_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(ELEMENT_CARD_STORE)) {
      database.createObjectStore(ELEMENT_CARD_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(NOMENCLATURE_SESSION_STORE)) {
      database.createObjectStore(NOMENCLATURE_SESSION_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(SYNC_OUTBOX_STORE)) {
      database.createObjectStore(SYNC_OUTBOX_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(SYNC_QUARANTINE_STORE)) {
      database.createObjectStore(SYNC_QUARANTINE_STORE, { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains(ACCOUNT_META_STORE)) {
      database.createObjectStore(ACCOUNT_META_STORE, { keyPath: "key" });
    }
    if (event.oldVersion < 3 && database.objectStoreNames.contains(ATTEMPT_EVENT_STORE)) {
      migrateAttemptEvents(request.transaction?.objectStore(ATTEMPT_EVENT_STORE));
    }
  };

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        isVersionError(request.error)
          ? new Error(
              "Lokální data vytvořila novější verze aplikace. Aktualizujte tuto stránku; data nebyla smazána.",
            )
          : (request.error ?? new Error("IndexedDB database open failed.")),
      );
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
