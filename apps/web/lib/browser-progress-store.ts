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

const baseAttemptSchema = z.strictObject({
  id: z.string().min(1),
  questionId: z.string().min(1),
  contentVersion: z.string().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  isCorrect: z.boolean(),
  round: z.enum(["initial", "retry"]),
});

const elementAttemptSchema = baseAttemptSchema.extend({
  mode: z.literal("element-name"),
  direction: z.literal("symbol-to-name"),
  matchPolicy: z.literal("diacritics-tolerant"),
});

const periodicAttemptSchema = baseAttemptSchema
  .extend({
    mode: z.literal("periodic-table"),
    direction: z.enum(["name-to-position", "position-to-name", "position-to-name-or-symbol"]),
    matchPolicy: z.enum(["exact-position", "diacritics-tolerant", "name-tolerant-or-symbol-exact"]),
  })
  .superRefine((event, context) => {
    if (
      (event.direction === "name-to-position" && event.matchPolicy !== "exact-position") ||
      (event.direction === "position-to-name" && event.matchPolicy !== "diacritics-tolerant") ||
      (event.direction === "position-to-name-or-symbol" &&
        event.matchPolicy !== "name-tolerant-or-symbol-exact")
    ) {
      context.addIssue({ code: "custom", message: "Invalid periodic-table attempt policy." });
    }
  });

const nomenclatureFields = {
  mode: z.literal("nomenclature"),
  eventSchemaVersion: z.literal(1),
  sessionId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  compoundId: z.string().min(1),
  outcome: z.enum(["correct", "incorrect", "revealed"]),
  match: z.enum(["canonical", "alias", "missing-diacritics", "none"]),
};

const nomenclatureNameAttemptSchema = baseAttemptSchema.extend({
  ...nomenclatureFields,
  direction: z.literal("formula-to-name"),
  matchPolicy: z.enum(["name-strict", "name-diacritics-tolerant"]),
});

const nomenclatureFormulaAttemptSchema = baseAttemptSchema.extend({
  ...nomenclatureFields,
  direction: z.literal("name-to-formula"),
  matchPolicy: z.literal("formula-canonical"),
});

export const attemptEventSchema = z.union([
  elementAttemptSchema,
  periodicAttemptSchema,
  nomenclatureNameAttemptSchema,
  nomenclatureFormulaAttemptSchema,
]);

export type AttemptEvent = z.infer<typeof attemptEventSchema>;
export type NomenclatureAttemptEvent = Extract<AttemptEvent, { mode: "nomenclature" }>;

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
        transaction.objectStore(ATTEMPT_EVENT_STORE).add(attemptEventSchema.parse(event));
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
