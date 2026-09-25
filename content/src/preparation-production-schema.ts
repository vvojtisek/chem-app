import { z } from "zod";

const sourceSchema = z.object({
  title: z.string().min(1),
  locator: z.url(),
});

const equationTermSchema = z.object({
  coefficient: z.number().int().min(1).max(999),
  formula: z.string().min(1).max(256),
  acceptedAliases: z.array(z.string().min(1).max(256)).optional(),
});

export const preparationProductionRouteSchema = z
  .object({
    id: z.string().regex(/^preparation-production\.route\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    sourceId: z.string().regex(/^id-[a-z0-9-]+$/u),
    kind: z.enum(["preparation", "manufacture"]),
    reactants: z.array(equationTermSchema).min(1),
    products: z.array(equationTermSchema).min(1),
    conditionsCs: z.string().max(120).nullable(),
    status: z.enum(["owner-approved", "in-review", "reviewed"]),
    reviewNote: z.string().min(1).optional(),
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
  .superRefine((route, context) => {
    if (route.status === "reviewed" && (!route.reviewedBy || !route.reviewedAt)) {
      context.addIssue({ code: "custom", message: "Reviewed routes require reviewer and date." });
    }
  });

const noteSchema = z.object({
  kind: z.enum(["preparation", "manufacture"]),
  text: z.string().min(1).max(2000),
});

export const preparationProductionProductSchema = z
  .object({
    id: z.string().regex(/^preparation-production\.product\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    nameCs: z.string().min(1),
    formula: z.string().min(1).max(256),
    notes: z.array(noteSchema),
    routes: z.array(preparationProductionRouteSchema),
    status: z.enum(["owner-approved", "reviewed"]),
    author: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    ownerApprovedBy: z.string().min(1),
    ownerApprovedAt: z.iso.date(),
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
  .superRefine((product, context) => {
    if (product.status === "reviewed" && (!product.reviewedBy || !product.reviewedAt)) {
      context.addIssue({ code: "custom", message: "Reviewed products require reviewer and date." });
    }
  });

export const preparationProductionCollectionSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().min(1).max(128),
  products: z.array(preparationProductionProductSchema).min(1),
});

export type PreparationProductionRoute = z.infer<typeof preparationProductionRouteSchema>;
export type PreparationProductionProduct = z.infer<typeof preparationProductionProductSchema>;
