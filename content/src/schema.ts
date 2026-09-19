import { z } from "zod";

const sourceSchema = z.object({
  title: z.string().min(1),
  locator: z.string().min(1),
});

export const elementRecordSchema = z
  .object({
    id: z.string().regex(/^element\.[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    atomicNumber: z.number().int().min(1).max(118),
    symbol: z.string().regex(/^[A-Z][a-z]?$/u),
    nameCs: z.string().min(1),
    nameLat: z.string().min(1),
    period: z.number().int().min(1).max(7),
    group: z.number().int().min(1).max(18).nullable(),
    atomicWeight: z.number().positive(),
    valenceConfiguration: z.string().min(1),
    status: z.enum(["draft", "in-review", "reviewed", "deprecated"]),
    author: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    reviewedBy: z.string().min(1).optional(),
    reviewedAt: z.iso.date().optional(),
  })
  .superRefine((record, context) => {
    if (record.status === "reviewed" && (!record.reviewedBy || !record.reviewedAt)) {
      context.addIssue({
        code: "custom",
        message: "Reviewed records require reviewedBy and reviewedAt.",
      });
    }
  });

export const elementCollectionSchema = z.array(elementRecordSchema);

export const groupRecordSchema = z
  .object({
    id: z.string().regex(/^periodic-group\.[0-9]{1,2}$/u),
    groupNumber: z.number().int().min(1).max(18),
    nameCs: z.string().min(1),
    mnemonicCs: z.string().min(1),
    elementSymbols: z.array(z.string().regex(/^[A-Z][a-z]?$/u)).min(1),
    status: z.enum(["draft", "in-review", "reviewed", "deprecated"]),
    author: z.string().min(1),
    sources: z.array(sourceSchema).min(1),
    reviewedBy: z.string().min(1).optional(),
    reviewedAt: z.iso.date().optional(),
  })
  .superRefine((record, context) => {
    if (record.status === "reviewed" && (!record.reviewedBy || !record.reviewedAt)) {
      context.addIssue({
        code: "custom",
        message: "Reviewed records require reviewedBy and reviewedAt.",
      });
    }
  });

export const groupCollectionSchema = z.array(groupRecordSchema);

export type ElementRecord = z.infer<typeof elementRecordSchema>;
export type GroupRecord = z.infer<typeof groupRecordSchema>;
