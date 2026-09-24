import { z } from "zod";

const sourceSchema = z.object({
  title: z.string().min(1),
  locator: z.url(),
});

const equationTermSchema = z.object({
  coefficient: z.number().int().min(1).max(999),
  formula: z.string().min(1).max(256),
});

export const preparationProductionRouteSchema = z.object({
  id: z.string().regex(/^preparation-production\.route\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  sourceId: z.string().regex(/^id-[a-z0-9-]+$/u),
  kind: z.enum(["preparation", "manufacture"]),
  reactants: z.array(equationTermSchema).min(1),
  products: z.array(equationTermSchema).min(1),
  conditionsCs: z.string().max(120).nullable(),
  status: z.enum(["owner-approved", "in-review"]),
  reviewNote: z.string().min(1).optional(),
});

const noteSchema = z.object({
  kind: z.enum(["preparation", "manufacture"]),
  text: z.string().min(1).max(2000),
});

export const preparationProductionProductSchema = z.object({
  id: z.string().regex(/^preparation-production\.product\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  nameCs: z.string().min(1),
  formula: z.string().min(1).max(256),
  notes: z.array(noteSchema),
  routes: z.array(preparationProductionRouteSchema),
  status: z.literal("owner-approved"),
  author: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  ownerApprovedBy: z.string().min(1),
  ownerApprovedAt: z.iso.date(),
});

export const preparationProductionCollectionSchema = z.object({
  schemaVersion: z.literal(1),
  products: z.array(preparationProductionProductSchema).min(1),
});

export type PreparationProductionRoute = z.infer<typeof preparationProductionRouteSchema>;
export type PreparationProductionProduct = z.infer<typeof preparationProductionProductSchema>;
