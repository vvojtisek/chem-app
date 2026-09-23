import { evaluateAnswer } from "./evaluate-answer";

export type ElementAnswerKind = "name" | "symbol";

export type ElementAnswerMatch =
  | "name"
  | "name-missing-diacritics"
  | "symbol"
  | "symbol-case-mismatch"
  | "none";

export interface ElementAnswerEvaluation {
  readonly isCorrect: boolean;
  readonly match: ElementAnswerMatch;
}

export interface ElementAnswerKey {
  readonly nameCs: string;
  readonly symbol: string;
}

export function evaluateElementAnswer(
  input: string,
  element: ElementAnswerKey,
  expected: ElementAnswerKind,
): ElementAnswerEvaluation {
  switch (expected) {
    case "symbol":
      return evaluateSymbol(input, element.symbol);
    case "name":
      return evaluateName(input, element.nameCs);
  }
}

function evaluateSymbol(input: string, symbol: string): ElementAnswerEvaluation {
  const trimmed = input.trim();
  if (trimmed === symbol) return { isCorrect: true, match: "symbol" };
  if (trimmed.toLowerCase() === symbol.toLowerCase()) {
    return { isCorrect: false, match: "symbol-case-mismatch" };
  }
  return { isCorrect: false, match: "none" };
}

function evaluateName(input: string, nameCs: string): ElementAnswerEvaluation {
  const name = evaluateAnswer(input, nameCs, { policy: "tolerant" });
  if (!name.isCorrect) return { isCorrect: false, match: "none" };
  return {
    isCorrect: true,
    match: name.match === "missing-diacritics" ? "name-missing-diacritics" : "name",
  };
}
