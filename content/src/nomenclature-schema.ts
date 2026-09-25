import { z } from "zod";

/** Practice categories offered by the pre-exercise filter. */
export const nomenclatureCategorySchema = z.enum([
  "element-ion",
  "oxide",
  "hydride",
  "binary-acid",
  "oxoacid",
  "hydroxide",
  "binary-salt",
  "oxoacid-salt",
  "coordination",
  "other",
]);

export const nomenclatureTagSchema = z.enum([
  "hydrate",
  "double-salt",
  "peroxide",
  "mixed-oxidation",
  "trivial-name",
]);

export const nomenclatureDirectionSchema = z.enum(["formula-to-name", "name-to-formula"]);

const sourceSchema = z.object({
  title: z.string().min(1),
  locator: z.string().min(1),
  kind: z.enum(["seed", "reference"]),
});

const aliasSchema = z.object({
  value: z.string().min(1),
  reason: z.string().min(1),
  sourceLocator: z.string().min(1),
});

export const nomenclatureRecordSchema = z
  .object({
    id: z.string().regex(/^nomenclature\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    sourceKey: z.string().min(1),
    formula: z.string().min(1),
    /** Net charge of an ion; the formula itself never contains a charge. */
    charge: z.number().int().min(-4).max(4),
    nameCs: z.string().min(1),
    explanationCs: z.string().min(1),
    baseCategory: nomenclatureCategorySchema.nullable(),
    tags: z.array(nomenclatureTagSchema),
    difficulty: z.enum(["basic", "intermediate", "advanced"]).nullable(),
    contextCs: z.string().min(1).nullable(),
    directions: z.array(nomenclatureDirectionSchema),
    aliases: z.object({
      names: z.array(aliasSchema),
      formulas: z.array(aliasSchema),
    }),
    disposition: z.enum(["core-candidate", "decision-required", "defer-grammar", "defer-scope"]),
    reviewIssues: z.array(z.string().regex(/^R[0-9]{2}$/u)),
    status: z.enum(["draft", "in-review", "owner-approved", "reviewed", "deprecated"]),
    author: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    reviewedBy: z.string().min(1).optional(),
    reviewedAt: z.iso.date().optional(),
    reviewFingerprint: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/u)
      .optional(),
    ownerApprovedBy: z.string().min(1).optional(),
    ownerApprovedAt: z.iso.date().optional(),
  })
  .superRefine((record, context) => {
    if (record.status !== "reviewed" && record.status !== "owner-approved") return;
    if (record.status === "reviewed" && (!record.reviewedBy || !record.reviewedAt)) {
      context.addIssue({ code: "custom", message: "Reviewed records require reviewer and date." });
    }
    if (
      record.status === "owner-approved" &&
      (!record.ownerApprovedBy || !record.ownerApprovedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Owner-approved records require approval attribution and date.",
      });
    }
    if (!record.sources.some((source) => source.kind === "reference")) {
      context.addIssue({
        code: "custom",
        message: "Published records require a scientific reference.",
      });
    }
    if (record.reviewIssues.length || record.disposition !== "core-candidate") {
      context.addIssue({ code: "custom", message: "Resolve review issues before release." });
    }
    if (!record.baseCategory) {
      context.addIssue({ code: "custom", message: "Published records require a category." });
    }
    if (record.charge !== 0 && record.directions.includes("name-to-formula")) {
      context.addIssue({
        code: "custom",
        message: "Ions are asked only from formula to name.",
      });
    }
    if (record.directions.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Published records require an enabled direction.",
      });
    }
  });

export const nomenclatureCollectionSchema = z.object({
  schemaVersion: z.literal(3),
  records: z.array(nomenclatureRecordSchema),
});

export const nomenclatureRuntimeRecordSchema = z.object({
  id: z.string(),
  reviewLevel: z.enum(["owner-approved", "sme-reviewed"]),
  formula: z.string(),
  charge: z.number().int(),
  nameCs: z.string(),
  explanationCs: z.string(),
  category: nomenclatureCategorySchema,
  /** Number of distinct elements in the formula, derived when the snapshot is generated. */
  elementCount: z.number().int().positive(),
  /** Anion word of a salt name without a hydrogen prefix (chlorid, síran), for quick filters. */
  anionFamily: z.string().nullable(),
  tags: z.array(nomenclatureTagSchema),
  contextCs: z.string().nullable(),
  directions: z.array(nomenclatureDirectionSchema),
  nameAliases: z.array(z.string()),
  formulaAliases: z.array(z.string()),
});

export const nomenclatureSnapshotSchema = z.object({
  schemaVersion: z.literal(3),
  contentVersion: z.string().min(1),
  compounds: z.array(nomenclatureRuntimeRecordSchema),
});

export type NomenclatureRecord = z.infer<typeof nomenclatureRecordSchema>;
export type NomenclatureRuntimeRecord = z.infer<typeof nomenclatureRuntimeRecordSchema>;
