import { z } from "zod";

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
export type AttemptDirection = "symbol-to-name" | "name-to-position" | "position-to-name";
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
      if (!attemptEventSchema.safeParse(event).success) {
        throw new Error("Pokus má neplatný kontext procvičování.");
      }

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

        return storedValues
          .flatMap((value) => {
            const parsed = attemptEventSchema.safeParse(value);
            return parsed.success ? [parsed.data] : [];
          })
          .sort((left, right) =>
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

const attemptBaseSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  contentVersion: z.string().min(1),
  occurredAt: z.iso.datetime(),
  isCorrect: z.boolean(),
  round: z.enum(["initial", "retry"]),
});

const attemptEventSchema = z.union([
  attemptBaseSchema.extend({
    mode: z.literal("element-name"),
    direction: z.literal("symbol-to-name"),
    matchPolicy: z.literal("diacritics-tolerant"),
  }),
  attemptBaseSchema.extend({
    mode: z.literal("periodic-table"),
    direction: z.literal("name-to-position"),
    matchPolicy: z.literal("exact-position"),
  }),
  attemptBaseSchema.extend({
    mode: z.literal("periodic-table"),
    direction: z.literal("position-to-name"),
    matchPolicy: z.literal("diacritics-tolerant"),
  }),
]) satisfies z.ZodType<AttemptEvent>;
