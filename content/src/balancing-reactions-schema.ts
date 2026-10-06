import { z } from "zod";

const sourceSchema = z.object({
  title: z.string().min(1),
  locator: z.url(),
});

const reviewStatusSchema = z.enum(["owner-approved", "in-review", "reviewed"]);
const categorySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const reactionSpeciesSchema = z.object({
  coefficient: z.number().int().min(1).max(999),
  formula: z.string().min(1).max(256),
  charge: z.number().int().min(-9).max(9).default(0),
});

const elementCountSchema = z.object({
  element: z.string().regex(/^[A-Z][a-z]?$/u),
  reactants: z.number().int().nonnegative(),
  products: z.number().int().nonnegative(),
});

const balanceLedgerSchema = z.object({
  atoms: z.array(elementCountSchema).optional(),
  charge: z
    .object({
      reactants: z.number().int(),
      products: z.number().int(),
    })
    .optional(),
  redoxPairs: z
    .array(
      z.object({
        species: z.string().min(1),
        fromOx: z.number().int(),
        toOx: z.number().int(),
        deltaE: z.number().int(),
      }),
    )
    .optional(),
});

export const interactiveStepSchema = z.object({
  stepIndex: z.number().int().min(1),
  title: z.string().min(1),
  kind: z.enum(["explanation", "summary"]).optional(),
  explanation: z.string().min(1),
  focusedSpecies: z.array(z.string().min(1)),
  /** Explicit coefficient changes; an empty list denotes a conceptual/result slide. */
  coefficientChanges: z.array(z.string().min(1)).optional(),
  currentEquationLaTeX: z.string().min(1),
  equation: z.object({
    reactants: z.array(reactionSpeciesSchema).min(1),
    products: z.array(reactionSpeciesSchema).min(1),
  }),
  balanceLedger: balanceLedgerSchema.optional(),
  ruleHighlight: z.string().min(1).optional(),
  notes: z
    .array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
    .max(6)
    .optional(),
});

export const balancingReactionLessonSchema = z
  .object({
    id: z.string().regex(/^reaction\.balancing\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    category: categorySchema,
    title: z.string().min(1),
    rawEquation: z.string().min(1),
    finalEquation: z.string().min(1),
    theoryContext: z.string().min(1),
    condition: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    phase: z.string().min(1).optional(),
    derivationConstraints: z
      .array(
        z.object({
          label: z.string().min(1),
          values: z.array(z.number().int()),
          explanation: z.string().min(1),
        }),
      )
      .optional(),
    steps: z.array(interactiveStepSchema).min(1),
    status: reviewStatusSchema,
    author: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    ownerApprovedBy: z.string().min(1).optional(),
    ownerApprovedAt: z.iso.date().optional(),
    reviewedBy: z
      .string()
      .regex(/^reviewer\.[a-z0-9]+(?:-[a-z0-9]+)*$/u)
      .optional(),
    reviewedAt: z.iso.date().optional(),
    reviewFingerprint: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/u)
      .optional(),
  })
  .superRefine((lesson, context) => {
    if (
      lesson.status === "owner-approved" &&
      (!lesson.ownerApprovedBy || !lesson.ownerApprovedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Owner-approved lessons require ownerApprovedBy and ownerApprovedAt.",
      });
    }
    if (lesson.status === "reviewed" && (!lesson.reviewedBy || !lesson.reviewedAt)) {
      context.addIssue({
        code: "custom",
        message: "Reviewed lessons require reviewedBy and reviewedAt.",
      });
    }
    const stepIndexes = lesson.steps.map((step) => step.stepIndex);
    if (new Set(stepIndexes).size !== stepIndexes.length) {
      context.addIssue({ code: "custom", message: "Interactive step indexes must be unique." });
    }
  });

export const balancingReactionCollectionSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().min(1).max(128),
  lessons: z.array(balancingReactionLessonSchema).min(1),
});

export type ReactionSpecies = z.infer<typeof reactionSpeciesSchema>;
export type InteractiveStep = z.infer<typeof interactiveStepSchema>;
export type BalancingReactionLesson = z.infer<typeof balancingReactionLessonSchema>;
export type BalancingReactionCollection = z.infer<typeof balancingReactionCollectionSchema>;
