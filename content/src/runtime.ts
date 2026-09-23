import rawElements from "../data/elements.json";
import rawGroups from "../data/groups.json";
import rawNomenclature from "../generated/nomenclature-runtime.json";
import { nomenclatureSnapshotSchema } from "./nomenclature-schema";

import {
  elementCollectionSchema,
  groupCollectionSchema,
  type ElementRecord,
  type GroupRecord,
} from "./schema";

export interface ElementFlashcardData {
  readonly id: string;
  readonly atomicNumber: number;
  readonly symbol: string;
  readonly nameCs: string;
  readonly nameLat: string;
  readonly period: number;
  readonly group: number | null;
  readonly atomicWeight: number;
  readonly valenceConfiguration: string;
}

export interface ElementGroupData {
  readonly groupNumber: number;
  readonly nameCs: string;
  readonly mnemonicCs: string;
}

export const curatedElements: readonly ElementFlashcardData[] = toRuntimeElements(
  elementCollectionSchema.parse(rawElements),
);

export const curatedGroups: readonly ElementGroupData[] = toRuntimeGroups(
  groupCollectionSchema.parse(rawGroups),
);

export const nomenclatureSnapshot = nomenclatureSnapshotSchema.parse(rawNomenclature);
export const curatedNomenclature = nomenclatureSnapshot.compounds;
export const nomenclatureContentVersion = nomenclatureSnapshot.contentVersion;

export const curriculumContentVersion = createCurriculumContentVersion({
  schemaVersion: 1,
  elements: curatedElements,
  groups: curatedGroups,
});

export function createCurriculumContentVersion(
  snapshot: Readonly<Record<string, unknown>>,
): string {
  const serializedSnapshot = JSON.stringify(snapshot);
  let hash = 0x811c9dc5;

  for (let index = 0; index < serializedSnapshot.length; index += 1) {
    hash ^= serializedSnapshot.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `curriculum-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function toRuntimeElements(
  records: readonly ElementRecord[],
): readonly ElementFlashcardData[] {
  return records
    .filter(isReviewed)
    .map(toElementFlashcardData)
    .sort((left, right) => left.atomicNumber - right.atomicNumber);
}

export function toRuntimeGroups(records: readonly GroupRecord[]): readonly ElementGroupData[] {
  return records
    .filter(isReviewed)
    .map(toElementGroupData)
    .sort((left, right) => left.groupNumber - right.groupNumber);
}

function isReviewed(record: { readonly status: ElementRecord["status"] }): boolean {
  return record.status === "reviewed";
}

function toElementFlashcardData(record: ElementRecord): ElementFlashcardData {
  return {
    id: record.id,
    atomicNumber: record.atomicNumber,
    symbol: record.symbol,
    nameCs: record.nameCs,
    nameLat: record.nameLat,
    period: record.period,
    group: record.group,
    atomicWeight: record.atomicWeight,
    valenceConfiguration: record.valenceConfiguration,
  };
}

function toElementGroupData(record: GroupRecord): ElementGroupData {
  return {
    groupNumber: record.groupNumber,
    nameCs: record.nameCs,
    mnemonicCs: record.mnemonicCs,
  };
}
