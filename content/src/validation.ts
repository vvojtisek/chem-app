import type { ElementRecord, GroupRecord, ReviewerRecord } from "./schema";

export interface ValidationProblem {
  readonly code:
    | "duplicate_id"
    | "duplicate_atomic_number"
    | "duplicate_symbol"
    | "duplicate_position"
    | "duplicate_group_number"
    | "duplicate_group_element_symbol"
    | "unknown_group_element_symbol"
    | "group_element_mismatch"
    | "duplicate_reviewer_id"
    | "unknown_reviewer"
    | "missing_review_fingerprint"
    | "stale_review_fingerprint"
    | "invalid_alternate_group_mnemonic";
  readonly recordId: string;
}

export function findGroupCollectionProblems(
  elements: readonly ElementRecord[],
  groups: readonly GroupRecord[],
): readonly ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const groupNumbers = new Set<number>();
  const elementsBySymbol = new Map(elements.map((element) => [element.symbol, element]));

  for (const group of groups) {
    if (groupNumbers.has(group.groupNumber)) {
      problems.push({ code: "duplicate_group_number", recordId: group.id });
    }
    groupNumbers.add(group.groupNumber);

    const symbols = new Set<string>();
    for (const symbol of group.elementSymbols) {
      if (symbols.has(symbol)) {
        problems.push({ code: "duplicate_group_element_symbol", recordId: group.id });
      }
      symbols.add(symbol);

      const element = elementsBySymbol.get(symbol);
      if (!element) {
        problems.push({ code: "unknown_group_element_symbol", recordId: group.id });
      } else if (element.group !== group.groupNumber) {
        problems.push({ code: "group_element_mismatch", recordId: group.id });
      }
    }
  }

  return problems;
}

export function findElementCollectionProblems(
  records: readonly ElementRecord[],
): readonly ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const ids = new Set<string>();
  const atomicNumbers = new Set<number>();
  const symbols = new Set<string>();
  const positions = new Map<string, string>();

  for (const record of records) {
    if (ids.has(record.id)) {
      problems.push({ code: "duplicate_id", recordId: record.id });
    }
    if (atomicNumbers.has(record.atomicNumber)) {
      problems.push({ code: "duplicate_atomic_number", recordId: record.id });
    }
    if (symbols.has(record.symbol)) {
      problems.push({ code: "duplicate_symbol", recordId: record.id });
    }
    if (record.group !== null) {
      const position = `${record.period}:${record.group}`;
      const occupyingRecordId = positions.get(position);

      if (occupyingRecordId && occupyingRecordId !== record.id) {
        problems.push({ code: "duplicate_position", recordId: record.id });
      } else {
        positions.set(position, record.id);
      }
    }

    ids.add(record.id);
    atomicNumbers.add(record.atomicNumber);
    symbols.add(record.symbol);
  }

  return problems;
}

export function findReviewerReferenceProblems(
  records: readonly (ElementRecord | GroupRecord)[],
  reviewers: readonly ReviewerRecord[],
): readonly ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const reviewerIds = new Set<string>();

  for (const reviewer of reviewers) {
    if (reviewerIds.has(reviewer.id)) {
      problems.push({ code: "duplicate_reviewer_id", recordId: reviewer.id });
    }
    reviewerIds.add(reviewer.id);
  }

  for (const record of records) {
    if (record.reviewedBy && !reviewerIds.has(record.reviewedBy)) {
      problems.push({ code: "unknown_reviewer", recordId: record.id });
    }
  }

  return problems;
}
