import { describe, expect, it } from "vitest";
import rawAlternatives from "../data/alternate-group-mnemonics.json";
import rawElements from "../data/elements.json";
import rawGroups from "../data/groups.json";
import { alternateGroupMnemonicCollectionSchema } from "./alternate-group-mnemonic-schema";
import { findAlternateGroupMnemonicProblems } from "./alternate-group-mnemonic-validation";
import { elementCollectionSchema, groupCollectionSchema } from "./schema";

const alternatives = alternateGroupMnemonicCollectionSchema.parse(rawAlternatives).records;
const elements = elementCollectionSchema.parse(rawElements);
const groups = groupCollectionSchema.parse(rawGroups);

describe("alternate group mnemonic validation", () => {
  it("accepts owner-provided mnemonic initials in group order", () => {
    expect(findAlternateGroupMnemonicProblems(alternatives, elements, groups)).toEqual([]);
  });

  it("rejects a mnemonic whose words do not follow its element initials", () => {
    const record = alternatives.find(({ groupNumber }) => groupNumber === 14);
    expect(record).toBeDefined();
    if (!record) return;

    const problems = findAlternateGroupMnemonicProblems(
      [{ ...record, mnemonicCs: "Captain Badly Generuje Snap, Pak Bouchne Flash." }],
      elements,
      groups,
    );

    expect(problems).toContain(
      "group-mnemonic-alternative.14: mnemonic words do not follow the element-symbol initials",
    );
  });

  it("rejects unrendered Markdown markers in learner-facing mnemonic text", () => {
    const record = alternatives.find(({ groupNumber }) => groupNumber === 14);
    expect(record).toBeDefined();
    if (!record) return;

    const problems = findAlternateGroupMnemonicProblems(
      [{ ...record, mnemonicCs: "Captain Silně Generuje S****nap, Pak Bouchne Flash." }],
      elements,
      groups,
    );

    expect(problems).toContain(
      "group-mnemonic-alternative.14: mnemonic contains unrendered Markdown formatting",
    );
  });
});
