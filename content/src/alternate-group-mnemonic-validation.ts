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

    const initials = [...record.mnemonicCs.matchAll(/[\p{L}]+/gu)].map(([word]) =>
      (word ?? "").slice(0, 1).toLocaleLowerCase("cs-CZ"),
    );
    let nextInitial = 0;
    for (const symbol of record.elementSymbols) {
      const initial = symbol.slice(0, 1).toLocaleLowerCase("cs-CZ");
      while (initials[nextInitial] !== undefined && initials[nextInitial] !== initial) {
        nextInitial += 1;
      }
      if (initials[nextInitial] === undefined) {
        problems.push(`${record.id}: mnemonic words do not follow the element-symbol initials`);
        break;
      }
      nextInitial += 1;
    }

    if (/[*_`]/u.test(record.mnemonicCs)) {
      problems.push(`${record.id}: mnemonic contains unrendered Markdown formatting`);
    }
  }

  return problems;
}
