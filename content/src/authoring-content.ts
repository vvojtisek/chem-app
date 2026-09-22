import { readFile } from "node:fs/promises";

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
  reviewers: new URL("../data/reviewers.json", import.meta.url),
} as const;

export interface AuthoringContent {
  readonly elements: readonly ElementRecord[];
  readonly groups: readonly GroupRecord[];
  readonly reviewers: readonly ReviewerRecord[];
}

export async function readJsonFile(file: URL): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function loadAuthoringContent(): Promise<AuthoringContent> {
  return {
    elements: elementCollectionSchema.parse(await readJsonFile(contentFiles.elements)),
    groups: groupCollectionSchema.parse(await readJsonFile(contentFiles.groups)),
    reviewers: reviewerCollectionSchema.parse(await readJsonFile(contentFiles.reviewers)),
  };
}

export function findContentProblems(content: AuthoringContent): readonly ValidationProblem[] {
  const reviewableRecords = [...content.elements, ...content.groups];

  return [
    ...findElementCollectionProblems(content.elements),
    ...findGroupCollectionProblems(content.elements, content.groups),
    ...findReviewerReferenceProblems(reviewableRecords, content.reviewers),
    ...findReviewFingerprintProblems(reviewableRecords, content.reviewers),
  ];
}
