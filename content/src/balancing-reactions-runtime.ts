import rawData from "../data/balancing-reactions.json";
import { curatedElements } from "./runtime";
import {
  balancingReactionCollectionSchema,
  type BalancingReactionLesson,
  type InteractiveStep,
  type ReactionSpecies,
} from "./balancing-reactions-schema";
import { findBalancingReactionProblems } from "./balancing-reactions-validation";

export const BALANCING_REACTION_CATEGORIES = [1, 2, 3, 4, 5, 6] as const;

export const BALANCING_REACTION_CATEGORY_LABELS: Readonly<
  Record<(typeof BALANCING_REACTION_CATEGORIES)[number], string>
> = {
  1: "Bez oxidačně-redukčních změn",
  2: "Lehčí oxidačně-redukční",
  3: "Těžší oxidačně-redukční",
  4: "Disproporcionační a/nebo synproporcionační",
  5: "Složité oxidačně-redukční",
  6: "Speciality",
};

const collection = balancingReactionCollectionSchema.parse(rawData);
const allowedSymbols = new Set(curatedElements.map((element) => element.symbol));
const problems = findBalancingReactionProblems(collection.lessons, allowedSymbols);
if (problems.length > 0) {
  throw new Error(`Balancing reaction content is invalid: ${JSON.stringify(problems)}`);
}

export const balancingReactionContentVersion = collection.contentVersion;

export type BalancingReactionRuntimeSpecies = Readonly<ReactionSpecies>;
export type BalancingReactionRuntimeStep = Readonly<InteractiveStep>;
export type BalancingReactionRuntimeLesson = Readonly<BalancingReactionLesson>;

export const curatedBalancingReactionLessons: readonly BalancingReactionRuntimeLesson[] =
  collection.lessons.filter(
    (lesson) => lesson.status === "owner-approved" || lesson.status === "reviewed",
  );
