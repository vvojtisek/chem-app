import { z } from "zod";

import {
  ACCOUNT_META_STORE,
  ATTEMPT_EVENT_STORE,
  LEARNING_DATABASE_NAME,
  LEARNING_DATABASE_VERSION,
  openLearningDatabase,
  requestCompleted,
  SYNC_OUTBOX_STORE,
  transactionCompleted,
} from "./browser-learning-database";
import {
  attemptGeneration,
  INITIAL_PROGRESS_GENERATION,
  progressGenerationSchema,
} from "./progress-generation";

export const PROGRESS_DATABASE_NAME = LEARNING_DATABASE_NAME;
export const PROGRESS_DATABASE_VERSION = LEARNING_DATABASE_VERSION;

const baseAttemptSchema = z.strictObject({
  id: z.string().min(1),
  questionId: z.string().min(1),
  contentVersion: z.string().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  isCorrect: z.boolean(),
  round: z.enum(["initial", "retry"]),
  progressGeneration: progressGenerationSchema.optional(),
});

const elementAttemptSchema = baseAttemptSchema.extend({
  mode: z.literal("element-name"),
  direction: z.literal("symbol-to-name"),
  matchPolicy: z.literal("diacritics-tolerant"),
});

const periodicAttemptSchema = baseAttemptSchema
  .extend({
    mode: z.literal("periodic-table"),
    direction: z.enum([
      "name-to-position",
      "position-to-name",
      "position-to-name-or-symbol",
      "name-to-symbol",
      "symbol-to-name",
    ]),
    matchPolicy: z.enum([
      "exact-position",
      "diacritics-tolerant",
      "name-tolerant-or-symbol-exact",
      "symbol-exact",
    ]),
  })
  .superRefine((event, context) => {
    if (
      (event.direction === "name-to-position" && event.matchPolicy !== "exact-position") ||
      (event.direction === "position-to-name" && event.matchPolicy !== "diacritics-tolerant") ||
      (event.direction === "position-to-name-or-symbol" &&
        event.matchPolicy !== "name-tolerant-or-symbol-exact") ||
      (event.direction === "name-to-symbol" && event.matchPolicy !== "symbol-exact") ||
      (event.direction === "symbol-to-name" && event.matchPolicy !== "diacritics-tolerant")
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
  match: z.enum(["canonical", "alias", "missing-diacritics", "normalized", "none"]),
};

const nomenclatureNameAttemptSchema = baseAttemptSchema.extend({
  ...nomenclatureFields,
  direction: z.literal("formula-to-name"),
  matchPolicy: z.enum(["name-strict", "name-diacritics-tolerant", "name-lenient"]),
});

const nomenclatureFormulaAttemptSchema = baseAttemptSchema.extend({
  ...nomenclatureFields,
  direction: z.literal("name-to-formula"),
  matchPolicy: z.literal("formula-canonical"),
});

const equationAttemptSchema = baseAttemptSchema
  .extend({
    mode: z.literal("equation"),
    eventSchemaVersion: z.literal(1),
    sessionId: z.string().min(1).max(128),
    sequence: z.number().int().min(0).max(1_000_000),
    level: z.enum(["beginner", "advanced", "pro"]),
    direction: z.enum(["coefficients", "products-and-coefficients", "complete-equation"]),
    matchPolicy: z.literal("approved-balanced"),
  })
  .superRefine((event, context) => {
    const directions = {
      beginner: "coefficients",
      advanced: "products-and-coefficients",
      pro: "complete-equation",
    } as const;
    if (event.direction !== directions[event.level]) {
      context.addIssue({ code: "custom", message: "Invalid equation level and direction." });
    }
  });

export const attemptEventSchema = z.union([
  elementAttemptSchema,
  periodicAttemptSchema,
  nomenclatureNameAttemptSchema,
  nomenclatureFormulaAttemptSchema,
  equationAttemptSchema,
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
  userId?: string,
): BrowserProgressStore {
  return {
    async appendAttempt(event) {
      if (!attemptEventSchema.safeParse(event).success) {
        throw new Error("Pokus má neplatný kontext procvičování.");
      }

      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(
          [ATTEMPT_EVENT_STORE, SYNC_OUTBOX_STORE, ACCOUNT_META_STORE],
          "readwrite",
        );
        const storedGeneration: unknown = await requestCompleted(
          transaction.objectStore(ACCOUNT_META_STORE).get("progress-generation"),
        );
        const current =
          typeof storedGeneration === "object" &&
          storedGeneration !== null &&
          "value" in storedGeneration &&
          typeof storedGeneration.value === "string"
            ? progressGenerationSchema.parse(storedGeneration.value)
            : INITIAL_PROGRESS_GENERATION;
        if (
          (event.progressGeneration && attemptGeneration(event) !== current) ||
          (userId && current !== INITIAL_PROGRESS_GENERATION && !event.progressGeneration)
        ) {
          transaction.abort();
          throw new Error("Pokrok účtu byl resetován. Obnovte stránku.");
        }
        const stamped =
          current === INITIAL_PROGRESS_GENERATION
            ? event
            : { ...event, progressGeneration: current };
        transaction.objectStore(ATTEMPT_EVENT_STORE).add(attemptEventSchema.parse(stamped));
        transaction.objectStore(SYNC_OUTBOX_STORE).add({ id: event.id });
        await transactionCompleted(transaction);
        if (typeof window !== "undefined")
          window.dispatchEvent(new Event("inorganic:attempt-saved"));
      } finally {
        database.close();
      }
    },

    async clearAttempts() {
      const database = await openLearningDatabase(indexedDb, userId);
      try {
        const transaction = database.transaction(
          [ATTEMPT_EVENT_STORE, SYNC_OUTBOX_STORE],
          "readwrite",
        );
        transaction.objectStore(ATTEMPT_EVENT_STORE).clear();
        transaction.objectStore(SYNC_OUTBOX_STORE).clear();
        await transactionCompleted(transaction);
      } finally {
        database.close();
      }
    },

    async listAttempts() {
      const database = await openLearningDatabase(indexedDb, userId);
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
