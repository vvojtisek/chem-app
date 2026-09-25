import { readFile } from "node:fs/promises";

import {
  type AlternateGroupMnemonicRecord,
  alternateGroupMnemonicCollectionSchema,
} from "./alternate-group-mnemonic-schema";
import { findAlternateGroupMnemonicProblems } from "./alternate-group-mnemonic-validation";
import { findReviewFingerprintProblems } from "./review";
import {
  type ElementRecord,
  elementCollectionSchema,
  type GroupRecord,
  groupCollectionSchema,
  type ReviewerRecord,
  reviewerCollectionSchema,
} from "./schema";
import {
  findElementCollectionProblems,
  findGroupCollectionProblems,
  findReviewerReferenceProblems,
  type ValidationProblem,
} from "./validation";

export const contentFiles = {
  elements: new URL("../data/elements.json", import.meta.url),
  groups: new URL("../data/groups.json", import.meta.url),
  alternateGroupMnemonics: new URL("../data/alternate-group-mnemonics.json", import.meta.url),
  reviewers: new URL("../data/reviewers.json", import.meta.url),
} as const;

export interface AuthoringContent {
  readonly elements: readonly ElementRecord[];
  readonly groups: readonly GroupRecord[];
  readonly alternateGroupMnemonics: readonly AlternateGroupMnemonicRecord[];
  readonly reviewers: readonly ReviewerRecord[];
}

export async function readJsonFile(file: URL): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function loadAuthoringContent(): Promise<AuthoringContent> {
  return {
    elements: elementCollectionSchema.parse(await readJsonFile(contentFiles.elements)),
    groups: groupCollectionSchema.parse(await readJsonFile(contentFiles.groups)),
    alternateGroupMnemonics: alternateGroupMnemonicCollectionSchema.parse(
      await readJsonFile(contentFiles.alternateGroupMnemonics),
    ).records,
    reviewers: reviewerCollectionSchema.parse(await readJsonFile(contentFiles.reviewers)),
  };
}

export function findContentProblems(content: AuthoringContent): readonly ValidationProblem[] {
  const reviewableRecords = [
    ...content.elements,
    ...content.groups,
    ...content.alternateGroupMnemonics,
  ];

  return [
    ...findElementCollectionProblems(content.elements),
    ...findGroupCollectionProblems(content.elements, content.groups),
    ...findAlternateGroupMnemonicProblems(
      content.alternateGroupMnemonics,
      content.elements,
      content.groups,
    ).map((problem) => ({
      code: "invalid_alternate_group_mnemonic" as const,
      recordId: problem,
    })),
    ...findReviewerReferenceProblems(reviewableRecords, content.reviewers),
    ...findReviewFingerprintProblems(reviewableRecords, content.reviewers),
  ];
}
