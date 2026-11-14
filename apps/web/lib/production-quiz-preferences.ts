import { z } from "zod";

import { readStoredJson, writeStoredJson } from "./local-preferences";

export const PRODUCTION_QUIZ_MODE_KEY = "inorganic.productionQuiz.mode";

/** Lehká (choice), Pokročilá (typed products) and Pro (typed whole reaction). */
export const productionQuizModeSchema = z.enum(["easy", "advanced", "pro"]);
export type ProductionQuizMode = z.infer<typeof productionQuizModeSchema>;

const storedModeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: productionQuizModeSchema,
});

export function loadProductionQuizMode(): ProductionQuizMode | null {
  const parsed = storedModeSchema.safeParse(readStoredJson(PRODUCTION_QUIZ_MODE_KEY));
  return parsed.success ? parsed.data.mode : null;
}

export function saveProductionQuizMode(mode: ProductionQuizMode): void {
  writeStoredJson(PRODUCTION_QUIZ_MODE_KEY, {
    schemaVersion: 1,
    mode,
  } satisfies z.infer<typeof storedModeSchema>);
}
