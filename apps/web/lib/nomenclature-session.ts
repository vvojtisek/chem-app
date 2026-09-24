import {
  type NomenclatureRuntimeRecord,
  nomenclatureCategorySchema,
  type nomenclatureDirectionSchema,
} from "@inorganic/content/nomenclature-schema";
import { z } from "zod";

export type NomenclatureCategory = z.infer<typeof nomenclatureCategorySchema>;
export type NomenclatureDirection = z.infer<typeof nomenclatureDirectionSchema>;

export const NOMENCLATURE_CATEGORIES = nomenclatureCategorySchema.options;

export const elementCountFilterSchema = z.enum(["1", "2", "3", "4+", "all"]);
export type ElementCountFilter = z.infer<typeof elementCountFilterSchema>;

export const nomenclatureFiltersSchema = z.strictObject({
  categories: z.array(nomenclatureCategorySchema),
  /** Quick selections inside a salt category, as "category:family" (for example "binary-salt:chlorid"). */
  families: z.array(z.string().regex(/^[a-z-]+:\p{L}+$/u)),
  elementCount: elementCountFilterSchema,
});
export type NomenclatureFilters = z.infer<typeof nomenclatureFiltersSchema>;

export const DEFAULT_NOMENCLATURE_FILTERS: NomenclatureFilters = {
  categories: [...NOMENCLATURE_CATEGORIES],
  families: [],
  elementCount: "all",
};

/** A family appears as a quick selection once its category holds at least this many records. */
export const MIN_QUICK_FAMILY_SIZE = 3;

export function elementCountBucket(elementCount: number): Exclude<ElementCountFilter, "all"> {
  if (elementCount >= 4) return "4+";
  return elementCount === 1 ? "1" : elementCount === 2 ? "2" : "3";
}

function familyKey(record: NomenclatureRuntimeRecord): string | null {
  return record.anionFamily ? `${record.category}:${record.anionFamily}` : null;
}

export function matchesElementCount(
  record: NomenclatureRuntimeRecord,
  filter: ElementCountFilter,
): boolean {
  return filter === "all" || elementCountBucket(record.elementCount) === filter;
}

/** Categories AND element count; inside a category, selected quick families narrow it further. */
export function filterCompounds(
  compounds: readonly NomenclatureRuntimeRecord[],
  filters: NomenclatureFilters,
): readonly NomenclatureRuntimeRecord[] {
  const categories = new Set(filters.categories);
  const families = new Set(filters.families);
  const narrowed = new Set(filters.families.map((family) => family.split(":")[0]));
  return compounds.filter((record) => {
    if (!categories.has(record.category) || !matchesElementCount(record, filters.elementCount)) {
      return false;
    }
    if (!narrowed.has(record.category)) return true;
    const key = familyKey(record);
    return key !== null && families.has(key);
  });
}

export interface QuickFamily {
  readonly key: string;
  readonly family: string;
  readonly count: number;
}

export function listQuickFamilies(
  compounds: readonly NomenclatureRuntimeRecord[],
  category: NomenclatureCategory,
): readonly QuickFamily[] {
  const counts = new Map<string, number>();
  for (const record of compounds) {
    if (record.category === category && record.anionFamily) {
      counts.set(record.anionFamily, (counts.get(record.anionFamily) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, count]) => count >= MIN_QUICK_FAMILY_SIZE)
    .map(([family, count]) => ({ key: `${category}:${family}`, family, count }))
    .sort((left, right) => right.count - left.count || left.family.localeCompare(right.family));
}

/**
 * The preferred direction when the record offers it, otherwise its only one: formulas that
 * cannot be typed (ions, coordination notation) are asked by formula, and names whose accepted
 * variants are still undecided are asked by name.
 */
export function directionFor(
  record: NomenclatureRuntimeRecord,
  preferred: NomenclatureDirection,
): NomenclatureDirection {
  if (record.directions.includes(preferred)) return preferred;
  return record.directions[0] ?? preferred;
}

const counterSchema = z.number().int().nonnegative();

export const NOMENCLATURE_CHECKPOINT_VERSION = 2;

export const nomenclatureCheckpointSchema = z
  .strictObject({
    id: z.literal("active"),
    checkpointVersion: z.literal(NOMENCLATURE_CHECKPOINT_VERSION),
    revision: counterSchema,
    sessionId: z.string().min(1),
    contentVersion: z.string().min(1),
    filters: nomenclatureFiltersSchema,
    currentId: z.string().min(1),
    queueIds: z.array(z.string().min(1)),
    solvedIds: z.array(z.string().min(1)),
    missedIds: z.array(z.string().min(1)),
    correct: counterSchema,
    incorrect: counterSchema,
    total: z.number().int().positive(),
    sequence: counterSchema,
    elapsedMs: counterSchema,
  })
  .superRefine((checkpoint, context) => {
    const asked = [checkpoint.currentId, ...checkpoint.queueIds];
    if (
      new Set(asked).size !== asked.length ||
      asked.some((id) => checkpoint.solvedIds.includes(id))
    ) {
      context.addIssue({ code: "custom", message: "Invalid nomenclature practice queue." });
    }
  });

export type NomenclatureCheckpoint = z.infer<typeof nomenclatureCheckpointSchema>;

/** A stored in-progress practice from the series-based version before checkpoint version 2. */
export function isLegacyNomenclatureCheckpoint(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !("checkpointVersion" in value) &&
    "state" in value &&
    "settings" in value
  );
}
