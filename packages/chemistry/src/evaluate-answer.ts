import {
  compactLenientAnswer,
  normalizeAnswer,
  normalizeAnswerWithoutDiacritics,
  normalizeLenientAnswer,
} from "./normalize-answer";

/**
 * strict: case, Unicode composition and spacing only.
 * tolerant: strict plus missing diacritics.
 * lenient: tolerant plus dash variants, spaces around dashes, and word breaks.
 */
export type AnswerPolicy = "strict" | "tolerant" | "lenient";
export type AnswerMatch = "exact" | "alias" | "missing-diacritics" | "normalized" | "none";
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
  const accepted = [canonical, ...(options.aliases ?? [])];
  const normalizedInput = normalizeAnswer(input);
  if (normalizedInput === normalizeAnswer(canonical)) return { isCorrect: true, match: "exact" };
  if ((options.aliases ?? []).map(normalizeAnswer).includes(normalizedInput))
    return { isCorrect: true, match: "alias" };
  if (options.policy === "tolerant") {
    const withoutDiacritics = normalizeAnswerWithoutDiacritics(input);
    if (accepted.some((answer) => withoutDiacritics === normalizeAnswerWithoutDiacritics(answer)))
      return { isCorrect: true, match: "missing-diacritics" };
  }
  if (options.policy === "lenient") {
    const lenient = normalizeLenientAnswer(input);
    const compact = compactLenientAnswer(input);
    if (
      compact !== "" &&
      accepted.some(
        (answer) =>
          lenient === normalizeLenientAnswer(answer) || compact === compactLenientAnswer(answer),
      )
    )
      return { isCorrect: true, match: "normalized" };
  }
  return { isCorrect: false, match: "none" };
}
