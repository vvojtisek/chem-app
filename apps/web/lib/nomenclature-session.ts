import {
  nomenclatureCategorySchema,
  nomenclatureDirectionSchema,
  nomenclatureRuntimeRecordSchema,
  type NomenclatureRuntimeRecord,
} from "@inorganic/content/nomenclature-schema";
import { z } from "zod";
import type { ExerciseSessionState } from "./exercise-session";

export const nomenclatureQuestionSchema = nomenclatureRuntimeRecordSchema.extend({
  questionId: z.string().min(1),
  direction: nomenclatureDirectionSchema,
});

export type NomenclatureQuestion = z.infer<typeof nomenclatureQuestionSchema>;

export const nomenclatureSettingsSchema = z.strictObject({
  categories: z.array(z.union([nomenclatureCategorySchema, z.literal("hydrate")])),
  difficulties: z.array(z.enum(["basic", "intermediate", "advanced"])),
  direction: nomenclatureDirectionSchema,
  namePolicy: z.enum(["strict", "tolerant"]),
  length: z.union([z.literal(10), z.literal(20), z.literal("all")]),
});

export type NomenclatureSettings = z.infer<typeof nomenclatureSettingsSchema>;

const summarySchema = z.strictObject({
  initialCorrect: z.number().int().nonnegative(),
  initialIncorrect: z.number().int().nonnegative(),
  retryCorrect: z.number().int().nonnegative(),
  retryIncorrect: z.number().int().nonnegative(),
});

const ongoingSessionFields = {
  current: nomenclatureQuestionSchema,
  remaining: z.array(nomenclatureQuestionSchema).readonly(),
  retryQueue: z.array(nomenclatureQuestionSchema).readonly(),
  round: z.enum(["initial", "retry"]),
  summary: summarySchema,
};

export const exerciseStateSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("active"), ...ongoingSessionFields }),
  z.strictObject({
    status: z.literal("feedback"),
    ...ongoingSessionFields,
    isCorrect: z.boolean(),
  }),
  z.strictObject({ status: z.literal("complete"), summary: summarySchema }),
]);

export const nomenclatureCheckpointSchema = z.strictObject({
  id: z.literal("active"),
  revision: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  contentVersion: z.string().min(1),
  seed: z.number().int().nonnegative(),
  initialCount: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
  revealedInitial: z.number().int().nonnegative(),
  revealedRetry: z.number().int().nonnegative(),
  settings: nomenclatureSettingsSchema,
  state: exerciseStateSchema,
  input: z.string(),
  feedback: z
    .strictObject({
      answer: z.string(),
      match: z.enum(["canonical", "alias", "missing-diacritics", "none"]),
      revealed: z.boolean(),
    })
    .nullable(),
});

export type NomenclatureCheckpoint = z.infer<typeof nomenclatureCheckpointSchema>;

export function selectNomenclatureQuestions(
  compounds: readonly NomenclatureRuntimeRecord[],
  settings: NomenclatureSettings,
  seed: number,
): readonly NomenclatureQuestion[] {
  const categories = new Set(settings.categories);
  const difficulties = new Set(settings.difficulties);
  const candidates = compounds
    .filter(
      (record) =>
        record.directions.includes(settings.direction) &&
        difficulties.has(record.difficulty) &&
        (categories.has(record.baseCategory) ||
          (categories.has("hydrate") && record.tags.includes("hydrate"))),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => ({
      ...record,
      questionId: `${record.id}.${settings.direction}`,
      direction: settings.direction,
    }));
  let state = seed >>> 0;
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const next = state % (index + 1);
    const current = candidates[index];
    const selected = candidates[next];
    if (!current || !selected) throw new Error("Invalid question shuffle index.");
    candidates[index] = selected;
    candidates[next] = current;
  }
  return candidates.slice(0, settings.length === "all" ? candidates.length : settings.length);
}

export function countInitialAnswered(state: ExerciseSessionState<NomenclatureQuestion>): number {
  return state.summary.initialCorrect + state.summary.initialIncorrect;
}
