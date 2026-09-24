import {
  ACCOUNT_META_STORE,
  ATTEMPT_EVENT_STORE,
  openLearningDatabase,
  requestCompleted,
  SYNC_OUTBOX_STORE,
  SYNC_QUARANTINE_STORE,
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
    const outboxRequest = transaction.objectStore(SYNC_OUTBOX_STORE).getAll(undefined, limit);
    const recordsPromise = new Promise<
      {
        readonly outboxKey: IDBValidKey | null;
        readonly outboxValue: unknown;
        readonly eventValue: unknown;
      }[]
    >((resolve, reject) => {
      outboxRequest.onsuccess = () => {
        const outboxValues: unknown[] = outboxRequest.result;
        const lookups = outboxValues.map((outboxValue) => {
          const outboxKey = getOutboxKey(outboxValue);
          if (outboxKey === null) {
            return Promise.resolve({ outboxKey: null, outboxValue, eventValue: undefined });
          }
          return requestCompleted<unknown>(
            transaction.objectStore(ATTEMPT_EVENT_STORE).get(outboxKey),
          ).then((eventValue) => ({ outboxKey, outboxValue, eventValue }));
        });
        void Promise.all(lookups).then(resolve, reject);
      };
      outboxRequest.onerror = () =>
        reject(outboxRequest.error ?? new Error("Unable to read sync outbox."));
    });
    const records = await recordsPromise;
    await transactionCompleted(transaction);
    const attempts: AttemptEvent[] = [];
    const unreadable: QuarantineInput[] = [];
    for (const [index, record] of records.entries()) {
      try {
        if (record.outboxKey === null) throw new Error("Missing outbox key.");
        attempts.push(attemptEventSchema.parse(record.eventValue));
      } catch {
        const eventId = getOutboxId(record.outboxValue);
        unreadable.push({
          id: eventId ?? `unreadable-${Date.now()}-${index}`,
          eventId,
          ...(record.outboxKey !== null ? { outboxKey: record.outboxKey } : {}),
          raw: record.eventValue ?? record.outboxValue,
          source: "local",
          reason: "Local attempt data is missing or no longer matches a supported format.",
        });
      }
    }
    if (unreadable.length > 0) await quarantineAttemptsInDatabase(database, unreadable);
    return attempts;
  } finally {
    database.close();
  }
}

export interface QuarantinedAttemptSummary {
  readonly total: number;
  readonly recentReasons: readonly string[];
}

export interface QuarantineInput {
  readonly id: string;
  readonly eventId: string | null;
  readonly outboxKey?: IDBValidKey;
  readonly raw: unknown;
  readonly source: "local" | "server";
  readonly reason: string;
}

export async function quarantineRejectedAttempts(
  indexedDb: IDBFactory,
  userId: string,
  attempts: readonly QuarantineInput[],
): Promise<void> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    await quarantineAttemptsInDatabase(database, attempts);
  } finally {
    database.close();
  }
}

export async function quarantineSummary(
  indexedDb: IDBFactory,
  userId: string,
): Promise<QuarantinedAttemptSummary> {
  const database = await openLearningDatabase(indexedDb, userId);
  try {
    const transaction = database.transaction(SYNC_QUARANTINE_STORE, "readonly");
    const store = transaction.objectStore(SYNC_QUARANTINE_STORE);
    const [total, records] = await Promise.all([
      requestCompleted(store.count()),
      requestCompleted<unknown[]>(store.getAll(undefined, 100)),
    ]);
    await transactionCompleted(transaction);
    return {
      total,
      recentReasons: [...records]
        .sort((left, right) => quarantineDate(right) - quarantineDate(left))
        .slice(0, 5)
        .flatMap((value) =>
          typeof value === "object" &&
          value !== null &&
          "reason" in value &&
          typeof value.reason === "string"
            ? [value.reason]
            : [],
        ),
    };
  } finally {
    database.close();
  }
}

async function quarantineAttemptsInDatabase(
  database: IDBDatabase,
  attempts: readonly QuarantineInput[],
): Promise<void> {
  const transaction = database.transaction([SYNC_OUTBOX_STORE, SYNC_QUARANTINE_STORE], "readwrite");
  const outbox = transaction.objectStore(SYNC_OUTBOX_STORE);
  const quarantine = transaction.objectStore(SYNC_QUARANTINE_STORE);
  for (const attempt of attempts) {
    quarantine.put({
      id: attempt.id,
      eventId: attempt.eventId,
      raw: attempt.raw,
      source: attempt.source,
      reason: attempt.reason,
      quarantinedAt: new Date().toISOString(),
    });
    if (attempt.outboxKey !== undefined) outbox.delete(attempt.outboxKey);
  }
  await transactionCompleted(transaction);
}

function getOutboxKey(value: unknown): IDBValidKey | null {
  if (typeof value !== "object" || value === null || !("id" in value)) return null;
  const key = value.id;
  return typeof key === "string" || typeof key === "number" ? key : null;
}

function getOutboxId(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
    ? value.id
    : null;
}

function quarantineDate(value: unknown): number {
  if (typeof value !== "object" || value === null || !("quarantinedAt" in value)) return 0;
  return typeof value.quarantinedAt === "string" ? Date.parse(value.quarantinedAt) || 0 : 0;
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
