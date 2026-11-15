"use client";

import { curatedElements } from "@inorganic/content/runtime";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { czechCount } from "@/lib/czech-plural";
import { saveElementSelection } from "@/lib/periodic-table-preferences";
import type { ResumableExercise } from "@/lib/practice-checkpoints";
import type { ReviewSummary } from "@/lib/review-items";
import { saveReviewRequest } from "@/lib/review-request";

const elementsById = new Map(curatedElements.map((element) => [element.id, element]));
const ELEMENT_FORMS = ["prvek", "prvky", "prvků"] as const;
const COMPOUND_FORMS = ["sloučenina", "sloučeniny", "sloučenin"] as const;
const EQUATION_FORMS = ["rovnice", "rovnice", "rovnic"] as const;
const DIRECTION_LABELS = {
  "formula-to-name": "Vzorec → Název",
  "name-to-formula": "Název → Vzorec",
} as const;
const LEVEL_LABELS = { beginner: "Střední", advanced: "Pokročilá", pro: "Pro" } as const;

const actionClass =
  "min-h-11 shrink-0 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2";
const linkClass = "font-semibold text-accent-strong underline";

function Row({
  title,
  detail,
  children,
}: Readonly<{ title: string; detail: string; children: ReactNode }>) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-2">{detail}</p>
      </div>
      {children}
    </li>
  );
}

/**
 * Cross-exercise review: the weakest rated items of each exercise, from this device's answers.
 * Each row starts a round of only those items; an unfinished round of the same exercise has to
 * be finished first, so a review never replaces saved work.
 */
export function ReviewPanel({
  review,
  inProgress,
}: Readonly<{ review: ReviewSummary; inProgress: readonly ResumableExercise[] }>) {
  const router = useRouter();
  const { elementIds, nomenclature, equations } = review;
  if (elementIds.length === 0 && !nomenclature && !equations) return null;
  const unfinished = (kind: ResumableExercise["kind"]) =>
    inProgress.find((item) => item.kind === kind);
  const blindTable = unfinished("periodic-position");
  const nomenclatureRound = unfinished("nomenclature");
  const elementNames = elementIds
    .map((id) => elementsById.get(id)?.nameCs)
    .filter((name) => name !== undefined);

  return (
    <section
      aria-labelledby="review-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink" id="review-heading">
        K zopakování
      </h2>
      <ul className="mt-3 list-none p-0">
        {elementIds.length > 0 ? (
          <Row
            detail={`${czechCount(elementIds.length, ELEMENT_FORMS)}: ${elementNames.join(", ")}`}
            title="Slepá periodická tabulka"
          >
            {blindTable ? (
              <Link className={linkClass} href={blindTable.href}>
                Nejdřív dokončit rozpracovanou
              </Link>
            ) : (
              <button
                className={actionClass}
                onClick={() => {
                  saveElementSelection(new Set(elementIds));
                  router.push("/procvicovani/periodicka-tabulka");
                }}
                type="button"
              >
                Zopakovat prvky
              </button>
            )}
          </Row>
        ) : null}
        {nomenclature ? (
          <Row
            detail={`${czechCount(nomenclature.compoundIds.length, COMPOUND_FORMS)} · ${DIRECTION_LABELS[nomenclature.direction]}`}
            title="Názvosloví"
          >
            {nomenclatureRound ? (
              <Link className={linkClass} href={nomenclatureRound.href}>
                Nejdřív dokončit rozpracované
              </Link>
            ) : (
              <button
                className={actionClass}
                onClick={() => {
                  saveReviewRequest({
                    exercise: "nomenclature",
                    direction: nomenclature.direction,
                    ids: [...nomenclature.compoundIds],
                  });
                  router.push("/procvicovani/nazvoslovi");
                }}
                type="button"
              >
                Zopakovat sloučeniny
              </button>
            )}
          </Row>
        ) : null}
        {equations ? (
          <Row
            detail={`${czechCount(equations.questionIds.length, EQUATION_FORMS)} · úroveň ${LEVEL_LABELS[equations.level]}`}
            title="Vyčíslování rovnic"
          >
            <button
              className={actionClass}
              onClick={() => {
                saveReviewRequest({
                  exercise: "equations",
                  level: equations.level,
                  ids: [...equations.questionIds],
                });
                router.push("/procvicovani/rovnice");
              }}
              type="button"
            >
              Zopakovat rovnice
            </button>
          </Row>
        ) : null}
      </ul>
    </section>
  );
}
