/** Mathematics owns everything under /predmety/matematika (ADR 0015). */
export const MATH_SUBJECT_ID = "matematika";
export const MATH_LEARN_PATH = `/predmety/${MATH_SUBJECT_ID}`;
export const MATH_PRACTICE_PATH = `${MATH_LEARN_PATH}/procvicovani`;

/** Učivo of one section: theory and the solver for the section's problem types. */
export function mathLearnPath(sectionId: string): string {
  return `${MATH_LEARN_PATH}/${sectionId}`;
}

/** Procvičovat of one section: its exercises. */
export function mathSectionPath(sectionId: string): string {
  return `${MATH_PRACTICE_PATH}/${sectionId}`;
}

export type MathArea = "learn" | "practice";

export function mathAreaPath(area: MathArea, sectionId: string): string {
  return area === "learn" ? mathLearnPath(sectionId) : mathSectionPath(sectionId);
}
