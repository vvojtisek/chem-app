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
}

export interface MathTopic {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: "draft";
  readonly responsibleEditor: "Codex";
  readonly sources: readonly string[];
  readonly verificationNote: string;
  readonly exercises: readonly MathExercise[];
}
