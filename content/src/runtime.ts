import rawElements from "../data/elements.json";
import rawGroups from "../data/groups.json";

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

export const curatedElements: readonly ElementFlashcardData[] = elementCollectionSchema
  .parse(rawElements)
  .map(toElementFlashcardData)
  .sort((left, right) => left.atomicNumber - right.atomicNumber);

export const curatedGroups: readonly ElementGroupData[] = groupCollectionSchema
  .parse(rawGroups)
  .map(toElementGroupData)
  .sort((left, right) => left.groupNumber - right.groupNumber);

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
