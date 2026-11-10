import type { MathSolverType } from "@inorganic/content/higher-mathematics";

/** Mathematics owns everything under /predmety/matematika (ADR 0015). */
export const MATH_SUBJECT_ID = "matematika";
export const MATH_LEARN_PATH = `/predmety/${MATH_SUBJECT_ID}`;
export const MATH_PRACTICE_PATH = `${MATH_LEARN_PATH}/procvicovani`;

export function mathSectionPath(sectionId: string): string {
  return `${MATH_PRACTICE_PATH}/${sectionId}`;
}

/** Učivo with one solver problem type preselected (read by SubjectWorkspace). */
export function mathSolverPath(type: MathSolverType): string {
  return `${MATH_LEARN_PATH}?typ=${type}`;
}

/** Czech labels of the solver problem types, as the API lists them. */
export const MATH_SOLVER_LABELS: Readonly<Record<MathSolverType, string>> = {
  limit: "Limita",
  derivative: "Derivace",
  implicit: "Implicitní derivace",
  integral: "Integrál",
  partial: "Parciální derivace",
  gradient: "Gradient",
  directional: "Směrová derivace",
  multiple_integral: "Dvojný a trojný integrál",
};
