import type { AlternateGroupMnemonicRecord } from "./alternate-group-mnemonic-schema";
import type { ElementRecord, GroupRecord } from "./schema";

export function findAlternateGroupMnemonicProblems(
  records: readonly AlternateGroupMnemonicRecord[],
  elements: readonly ElementRecord[],
  groups: readonly GroupRecord[],
): readonly string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const groupNumbers = new Set<number>();
  const groupNumbersByNumber = new Map(groups.map((group) => [group.groupNumber, group]));

  for (const record of records) {
    if (ids.has(record.id)) problems.push(`${record.id}: duplicate id`);
    if (groupNumbers.has(record.groupNumber)) {
      problems.push(`${record.id}: duplicate alternative for group ${record.groupNumber}`);
    }

    ids.add(record.id);
    groupNumbers.add(record.groupNumber);

    const group = groupNumbersByNumber.get(record.groupNumber);
    if (!group) {
      problems.push(`${record.id}: unknown group ${record.groupNumber}`);
      continue;
    }

    if (record.id !== `group-mnemonic-alternative.${record.groupNumber}`) {
      problems.push(`${record.id}: id does not match group ${record.groupNumber}`);
    }

    const actualSymbols = elements
      .filter((element) => element.group === record.groupNumber)
      .sort((left, right) => left.atomicNumber - right.atomicNumber)
      .map((element) => element.symbol);
    if (
      record.elementSymbols.length !== actualSymbols.length ||
      record.elementSymbols.some((symbol, index) => symbol !== actualSymbols[index])
    ) {
      problems.push(`${record.id}: element symbols do not match group ${record.groupNumber}`);
    }
  }

  return problems;
}
