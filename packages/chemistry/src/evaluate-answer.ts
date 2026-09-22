import { normalizeAnswer, normalizeAnswerWithoutDiacritics } from "./normalize-answer";

export type AnswerPolicy = "strict" | "tolerant";
export type AnswerMatch = "exact" | "alias" | "missing-diacritics" | "none";
export interface AnswerEvaluation {
  readonly isCorrect: boolean;
  readonly match: AnswerMatch;
}
export interface EvaluateAnswerOptions {
  readonly policy: AnswerPolicy;
  readonly aliases?: readonly string[];
}

export function evaluateAnswer(
  input: string,
  canonical: string,
  options: EvaluateAnswerOptions,
): AnswerEvaluation {
  const normalizedInput = normalizeAnswer(input);
  if (normalizedInput === normalizeAnswer(canonical)) return { isCorrect: true, match: "exact" };
  if ((options.aliases ?? []).map(normalizeAnswer).includes(normalizedInput))
    return { isCorrect: true, match: "alias" };
  if (options.policy === "tolerant") {
    const withoutDiacritics = normalizeAnswerWithoutDiacritics(input);
    if (
      [canonical, ...(options.aliases ?? [])].some(
        (answer) => withoutDiacritics === normalizeAnswerWithoutDiacritics(answer),
      )
    )
      return { isCorrect: true, match: "missing-diacritics" };
  }
  return { isCorrect: false, match: "none" };
}
