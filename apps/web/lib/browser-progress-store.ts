import {
  ATTEMPT_EVENT_STORE,
  LEARNING_DATABASE_NAME,
  LEARNING_DATABASE_VERSION,
  openLearningDatabase,
  requestCompleted,
  transactionCompleted,
} from "./browser-learning-database";

export const PROGRESS_DATABASE_NAME = LEARNING_DATABASE_NAME;
export const PROGRESS_DATABASE_VERSION = LEARNING_DATABASE_VERSION;

export type AttemptRound = "initial" | "retry";
export type AttemptMode = "element-name" | "periodic-table";
export type AttemptDirection = "symbol-to-name" | "name-to-position";
export type AttemptMatchPolicy = "diacritics-tolerant" | "exact-position";

export interface AttemptEvent {
  readonly id: string;
  readonly questionId: string;
  readonly contentVersion: string;
  readonly occurredAt: string;
  readonly isCorrect: boolean;
  readonly round: AttemptRound;
  readonly mode: AttemptMode;
  readonly direction: AttemptDirection;
  readonly matchPolicy: AttemptMatchPolicy;
}

export interface BrowserProgressStore {
  appendAttempt(event: AttemptEvent): Promise<void>;
  clearAttempts(): Promise<void>;
  listAttempts(): Promise<readonly AttemptEvent[]>;
}

export function createBrowserProgressStore(
  indexedDb: IDBFactory = globalThis.indexedDB,
): BrowserProgressStore {
  return {
    async appendAttempt(event) {
      const database = await openLearningDatabase(indexedDb);
      try {
        const transaction = database.transaction(ATTEMPT_EVENT_STORE, "readwrite");
        transaction.objectStore(ATTEMPT_EVENT_STORE).add(event);
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },

    async clearAttempts() {
      const database = await openLearningDatabase(indexedDb);
      try {
        const transaction = database.transaction(ATTEMPT_EVENT_STORE, "readwrite");
        transaction.objectStore(ATTEMPT_EVENT_STORE).clear();
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },

    async listAttempts() {
      const database = await openLearningDatabase(indexedDb);
      try {
        const transaction = database.transaction(ATTEMPT_EVENT_STORE, "readonly");
        const request = transaction.objectStore(ATTEMPT_EVENT_STORE).getAll();
        const storedValues = await requestCompleted<unknown[]>(request);
        await transactionCompleted(transaction);

        return [...storedValues.filter(isAttemptEvent)].sort((left, right) =>
          left.occurredAt === right.occurredAt
            ? left.id.localeCompare(right.id)
            : left.occurredAt.localeCompare(right.occurredAt),
        );
      } finally {
        database.close();
      }
    },
  };
}

function isAttemptEvent(value: unknown): value is AttemptEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.questionId === "string" &&
    typeof candidate.contentVersion === "string" &&
    typeof candidate.occurredAt === "string" &&
    typeof candidate.isCorrect === "boolean" &&
    (candidate.round === "initial" || candidate.round === "retry") &&
    isKnownAttemptContext(candidate)
  );
}

function isKnownAttemptContext(candidate: Record<string, unknown>): boolean {
  return (
    (candidate.mode === "element-name" &&
      candidate.direction === "symbol-to-name" &&
      candidate.matchPolicy === "diacritics-tolerant") ||
    (candidate.mode === "periodic-table" &&
      candidate.direction === "name-to-position" &&
      candidate.matchPolicy === "exact-position")
  );
}
