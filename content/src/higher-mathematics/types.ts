/** Structured mathematics exercises; text supports inline `$...$` TeX. */
export interface MathExercise {
  readonly id: string;
  readonly prompt: string;
  readonly answer: string;
  readonly answerLabel?: string;
  readonly acceptedAnswers?: readonly string[];
  readonly hints: readonly string[];
  readonly solutionSteps: readonly string[];
  readonly notation?: readonly string[];
  /**
   * The same problem for the server solver (ADR 0015). When present and the
   * learner is signed in and online, the solution shows the solver's verified
   * steps; the authored solutionSteps stay the offline fallback.
   */
  readonly solver?: MathSolverProblem;
}

export interface MathSolverProblem {
  readonly problemType: MathSolverType;
  readonly values: Readonly<Record<string, string>>;
}

/**
 * One block of section theory. Paragraphs and list items support inline
 * `$...$` TeX; `formulas` are display-mode TeX without dollar signs.
 */
export interface MathTheoryBlock {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly formulas?: readonly string[];
  readonly items?: readonly string[];
}

/**
 * Problem types of the server-side mathematics solver (ADR 0015) that the
 * learner can use for own examples of a section. Mirrors the ids in
 * apps/api/src/inorganic_api/subjects/mathematics/module.py.
 */
export type MathSolverType =
  | "limit"
  | "derivative"
  | "implicit"
  | "integral"
  | "partial"
  | "gradient"
  | "directional"
  | "multiple_integral";

export interface MathTopic {
  readonly id: string;
  /** Position in the course syllabus, 1 to 9. */
  readonly number: number;
  /** Official syllabus title of the section. */
  readonly title: string;
  /** Short label for tiles and breadcrumbs. */
  readonly shortTitle: string;
  readonly description: string;
  readonly status: "draft";
  /** Editor of the exercises. */
  readonly responsibleEditor: "Codex";
  /** Editor of the theory blocks. */
  readonly theoryEditor: "Claude";
  readonly sources: readonly string[];
  readonly verificationNote: string;
  readonly theory: readonly MathTheoryBlock[];
  readonly solverTypes: readonly MathSolverType[];
  readonly exercises: readonly MathExercise[];
}
