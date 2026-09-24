import { z } from "zod";

const sourceSchema = z.object({
  title: z.string().min(1),
  locator: z.string().min(1),
});

export const alternateGroupMnemonicRecordSchema = z.object({
  id: z.string().regex(/^group-mnemonic-alternative\.(?:[1-9]|1[0-8])$/u),
  groupNumber: z.number().int().min(1).max(18),
  traditionalLabelCs: z.string().min(1),
  elementSymbols: z.array(z.string().regex(/^[A-Z][a-z]?$/u)).min(1),
  mnemonicCs: z.string().min(1),
  explanationCs: z.string().min(1),
  status: z.literal("owner-approved"),
  author: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  ownerApprovedBy: z.string().min(1),
  ownerApprovedAt: z.iso.date(),
});

export const alternateGroupMnemonicCollectionSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(alternateGroupMnemonicRecordSchema),
});

export type AlternateGroupMnemonicRecord = z.infer<typeof alternateGroupMnemonicRecordSchema>;
