import { readFile } from "node:fs/promises";

import { elementCollectionSchema, groupCollectionSchema } from "./schema";
import { findElementCollectionProblems, findGroupCollectionProblems } from "./validation";

const elementFile = new URL("../data/elements.json", import.meta.url);
const groupFile = new URL("../data/groups.json", import.meta.url);
const rawElements: unknown = JSON.parse(await readFile(elementFile, "utf8"));
const rawGroups: unknown = JSON.parse(await readFile(groupFile, "utf8"));
const elements = elementCollectionSchema.parse(rawElements);
const groups = groupCollectionSchema.parse(rawGroups);
const problems = [
  ...findElementCollectionProblems(elements),
  ...findGroupCollectionProblems(elements, groups),
];

if (problems.length > 0) {
  throw new Error(`Content validation failed:\n${JSON.stringify(problems, null, 2)}`);
}

const reviewedCount = elements.filter((element) => element.status === "reviewed").length;
console.log(
  `Content validation passed: ${elements.length} elements (${reviewedCount} reviewed), ${groups.length} named groups.`,
);
