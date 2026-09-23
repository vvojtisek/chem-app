import { nomenclatureDirectionSchema } from "@inorganic/content/nomenclature-schema";
import { z } from "zod";

import { readStoredJson, writeStoredJson } from "./local-preferences";
import {
  type NomenclatureDirection,
  type NomenclatureFilters,
  nomenclatureFiltersSchema,
} from "./nomenclature-session";

export const NOMENCLATURE_FILTERS_KEY = "inorganic.nomenclature.filters";
export const NOMENCLATURE_DIRECTION_KEY = "inorganic.nomenclature.direction";

const storedFiltersSchema = z.strictObject({
  schemaVersion: z.literal(1),
  filters: nomenclatureFiltersSchema,
});

const storedDirectionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  direction: nomenclatureDirectionSchema,
});

export function loadNomenclatureFilters(): NomenclatureFilters | null {
  const parsed = storedFiltersSchema.safeParse(readStoredJson(NOMENCLATURE_FILTERS_KEY));
  return parsed.success ? parsed.data.filters : null;
}

export function saveNomenclatureFilters(filters: NomenclatureFilters): void {
  writeStoredJson(NOMENCLATURE_FILTERS_KEY, {
    schemaVersion: 1,
    filters,
  } satisfies z.infer<typeof storedFiltersSchema>);
}

export function loadNomenclatureDirection(): NomenclatureDirection | null {
  const parsed = storedDirectionSchema.safeParse(readStoredJson(NOMENCLATURE_DIRECTION_KEY));
  return parsed.success ? parsed.data.direction : null;
}

export function saveNomenclatureDirection(direction: NomenclatureDirection): void {
  writeStoredJson(NOMENCLATURE_DIRECTION_KEY, {
    schemaVersion: 1,
    direction,
  } satisfies z.infer<typeof storedDirectionSchema>);
}
