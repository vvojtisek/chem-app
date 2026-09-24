import {
  ACCOUNT_META_STORE,
  ATTEMPT_EVENT_STORE,
  openLearningDatabase,
  requestCompleted,
  SYNC_OUTBOX_STORE,
  transactionCompleted,
} from "../browser-learning-database";
import { type AttemptEvent, attemptEventSchema } from "../browser-progress-store";

export async function pendingCount(indexedDb: IDBFactory, userId: string): Promise<number> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = database.transaction(SYNC_OUTBOX_STORE, "readonly");
    const count = await requestCompleted(transaction.objectStore(SYNC_OUTBOX_STORE).count());
    await transactionCompleted(transaction);
    return count;
  } finally {
    database.close();
  }
}

export async function pendingAttempts(
  indexedDb: IDBFactory,
  userId: string,
  limit = 100,
): Promise<AttemptEvent[]> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = database.transaction([SYNC_OUTBOX_STORE, ATTEMPT_EVENT_STORE], "readonly");
    const ids = await requestCompleted<unknown[]>(
      transaction.objectStore(SYNC_OUTBOX_STORE).getAll(undefined, limit),
    );
    const validIds = ids.filter(
      (item): item is { id: string } =>
        typeof item === "object" && item !== null && "id" in item && typeof item.id === "string",
    );
    const values = await Promise.all(
      validIds.map(({ id }) =>
        requestCompleted<unknown>(transaction.objectStore(ATTEMPT_EVENT_STORE).get(id)),
      ),
    );
    await transactionCompleted(transaction);
    return values.map((value) => attemptEventSchema.parse(value));
  } finally {
    database.close();
  }
}

export async function acknowledgeAttempts(
  indexedDb: IDBFactory,
  userId: string,
  ids: readonly string[],
): Promise<void> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = database.transaction(SYNC_OUTBOX_STORE, "readwrite");
    for (const id of ids) transaction.objectStore(SYNC_OUTBOX_STORE).delete(id);
    await transactionCompleted(transaction);
  } finally {
    database.close();
  }
}

export async function pullCursor(indexedDb: IDBFactory, userId: string): Promise<string | null> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = database.transaction(ACCOUNT_META_STORE, "readonly");
    const meta: unknown = await requestCompleted(
      transaction.objectStore(ACCOUNT_META_STORE).get("pull-cursor"),
    );
    await transactionCompleted(transaction);
    return typeof meta === "object" &&
      meta !== null &&
      "value" in meta &&
      typeof meta.value === "string"
      ? meta.value
      : null;
  } finally {
    database.close();
  }
}

export async function savePulledAttempts(
  indexedDb: IDBFactory,
  userId: string,
  attempts: readonly AttemptEvent[],
  cursor: string | null,
): Promise<void> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = database.transaction(
      [ATTEMPT_EVENT_STORE, ACCOUNT_META_STORE],
      "readwrite",
    );
    for (const attempt of attempts)
      transaction.objectStore(ATTEMPT_EVENT_STORE).put(attemptEventSchema.parse(attempt));
    if (cursor !== null)
      transaction.objectStore(ACCOUNT_META_STORE).put({ key: "pull-cursor", value: cursor });
    await transactionCompleted(transaction);
  } finally {
    database.close();
  }
}
