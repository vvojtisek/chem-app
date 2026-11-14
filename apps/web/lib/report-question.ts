import { APP_VERSION } from "./app-version";

/** The public repository that tracks content problems (the project is open source). */
const ISSUE_REPOSITORY = "vvojtisek/chem-app";

export interface ReportedQuestion {
  /** Czech exercise name as shown in the page title. */
  readonly exercise: string;
  /** Stable reviewed-content identifier of the question. */
  readonly questionId: string;
  /** What the question showed, so the reviewer recognises it without looking up the ID. */
  readonly prompt: string;
}

/**
 * A prefilled GitHub issue for a suspected error in a question. Nothing is sent or stored by
 * the app: the learner reviews and submits the issue on GitHub. The URL carries only content
 * identifiers and the app version, never the learner's answer or account.
 */
export function reportQuestionUrl(question: ReportedQuestion): string {
  const body = [
    `Cvičení: ${question.exercise}`,
    `Otázka: ${question.prompt}`,
    `ID otázky: ${question.questionId}`,
    `Verze aplikace: ${APP_VERSION}`,
    "",
    "Co je podle vás špatně:",
    "",
  ].join("\n");
  const params = new URLSearchParams({
    title: `Chyba v otázce: ${question.prompt}`,
    body,
    labels: "content",
  });
  return `https://github.com/${ISSUE_REPOSITORY}/issues/new?${params.toString()}`;
}
