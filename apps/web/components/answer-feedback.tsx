import type { ReactNode } from "react";

import { type ReportedQuestion, reportQuestionUrl } from "@/lib/report-question";

import { CheckIcon, CrossIcon } from "./icons";

/**
 * The result of the previous answer: verdict word and icon, then the correct pair and any
 * explanation. It sits under the next prompt, so the flow never stops for an extra step.
 */
export function AnswerFeedback({
  isCorrect,
  children,
  report,
}: Readonly<{ isCorrect: boolean; children: ReactNode; report?: ReportedQuestion }>) {
  return (
    <div
      className={`mt-4 rounded-2xl border p-4 sm:p-5 ${
        isCorrect ? "border-good/40 bg-good-soft" : "border-bad/40 bg-bad-soft"
      }`}
    >
      <p className={`flex items-center gap-2 font-bold ${isCorrect ? "text-good" : "text-bad"}`}>
        {isCorrect ? <CheckIcon /> : <CrossIcon />}
        {isCorrect ? "Správně" : "Špatně"}
      </p>
      <div className="mt-1 grid gap-1 leading-7 text-ink">{children}</div>
      {report ? (
        <a
          className="mt-2 inline-flex min-h-9 items-center text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
          href={reportQuestionUrl(report)}
          rel="noreferrer"
          target="_blank"
        >
          Nahlásit chybu v otázce
        </a>
      ) : null}
    </div>
  );
}
