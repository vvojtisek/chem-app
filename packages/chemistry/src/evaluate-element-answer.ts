import { evaluateAnswer } from "./evaluate-answer";

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
): ElementAnswerEvaluation {
  const trimmed = input.trim();
  if (trimmed === element.symbol) return { isCorrect: true, match: "symbol" };

  const name = evaluateAnswer(input, element.nameCs, { policy: "tolerant" });
  if (name.isCorrect) {
    return {
      isCorrect: true,
      match: name.match === "missing-diacritics" ? "name-missing-diacritics" : "name",
    };
  }

  if (trimmed.toLowerCase() === element.symbol.toLowerCase()) {
    return { isCorrect: false, match: "symbol-case-mismatch" };
  }

  return { isCorrect: false, match: "none" };
}
