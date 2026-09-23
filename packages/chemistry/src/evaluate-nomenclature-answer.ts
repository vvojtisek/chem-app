import { evaluateAnswer, type AnswerPolicy } from "./evaluate-answer";
import { parseFormula, type FormulaParseErrorCode } from "./parse-formula";

export type NomenclatureDirection = "formula-to-name" | "name-to-formula";

export interface NomenclatureAnswerKey {
  readonly direction: NomenclatureDirection;
  readonly formula: string;
  readonly nameCs: string;
  readonly nameAliases?: readonly string[];
  readonly formulaAliases?: readonly string[];
}

export type NomenclatureEvaluation =
  | { readonly isCorrect: true; readonly match: "canonical" | "alias" | "missing-diacritics" }
  | {
      readonly isCorrect: false;
      readonly match: "none";
      readonly reason: "wrong-answer" | FormulaParseErrorCode;
    };

export function evaluateNomenclatureAnswer(
  key: NomenclatureAnswerKey,
  input: string,
  namePolicy: AnswerPolicy,
  allowedSymbols: ReadonlySet<string>,
): NomenclatureEvaluation {
  if (key.direction === "formula-to-name") {
    const result = evaluateAnswer(input, key.nameCs, {
      policy: namePolicy,
      aliases: key.nameAliases ?? [],
    });
    if (!result.isCorrect) return { isCorrect: false, match: "none", reason: "wrong-answer" };
    if (result.match === "none") throw new Error("Inconsistent name evaluation result.");
    return { isCorrect: true, match: result.match === "exact" ? "canonical" : result.match };
  }

  const parsed = parseFormula(input, allowedSymbols);
  if (!parsed.ok) return { isCorrect: false, match: "none", reason: parsed.error.code };
  const expected = parseFormula(key.formula, allowedSymbols);
  if (!expected.ok) throw new Error("Invalid reviewed nomenclature formula.");
  if (parsed.canonical === expected.canonical) return { isCorrect: true, match: "canonical" };
  for (const alias of key.formulaAliases ?? []) {
    const approved = parseFormula(alias, allowedSymbols);
    if (!approved.ok) throw new Error("Invalid reviewed nomenclature alias.");
    if (parsed.canonical === approved.canonical) return { isCorrect: true, match: "alias" };
  }
  return { isCorrect: false, match: "none", reason: "wrong-answer" };
}
