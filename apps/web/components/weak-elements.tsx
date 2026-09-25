"use client";

import { curatedElements } from "@inorganic/content/runtime";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import { cn } from "@/lib/class-names";
import { czechCount } from "@/lib/czech-plural";
import { calculatePeriodicTableMastery, weakestElements } from "@/lib/periodic-table-mastery";
import { saveElementSelection } from "@/lib/periodic-table-preferences";
import { listResumableExercises } from "@/lib/practice-checkpoints";
import { queryKeys } from "@/lib/query-keys";

const WEAK_ELEMENT_LIMIT = 5;
const ATTEMPT_FORMS = ["pokus", "pokusy", "pokusů"] as const;
const elementsById = new Map(curatedElements.map((element) => [element.id, element]));

/**
 * Targeted review: the weakest rated elements from this device's answers, practised in the blind
 * table by making them the shared element selection.
 */
export function WeakElements({
  userId,
  emptyText,
  compact = false,
}: Readonly<{ userId: string; emptyText?: string; compact?: boolean }>) {
  const router = useRouter();
  const attempts = useQuery({
    queryKey: queryKeys.me.periodicMastery(userId),
    queryFn: () => createBrowserProgressStore(indexedDB, userId).listAttempts(),
    retry: false,
  });
  const checkpoints = useQuery({
    queryKey: queryKeys.me.practiceCheckpoints(userId),
    queryFn: () => listResumableExercises(indexedDB, userId),
    retry: false,
  });
  const weak = useMemo(
    () => weakestElements(calculatePeriodicTableMastery(attempts.data ?? []), WEAK_ELEMENT_LIMIT),
    [attempts.data],
  );
  if (!attempts.isSuccess) return null;
  if (weak.length === 0 && !emptyText) return null;
  const blindTableInProgress = checkpoints.data?.some((item) => item.kind === "periodic-position");

  const action = (
    <>
      {blindTableInProgress ? (
        <p className="text-sm text-ink-2">
          Slepou tabulku máte rozpracovanou. Dokončete ji nebo ukončete, pak si tyto prvky
          procvičíte.{" "}
          <Link
            className="font-semibold text-accent-strong underline"
            href="/procvicovani/periodicka-tabulka"
          >
            Pokračovat ve slepé tabulce
          </Link>
        </p>
      ) : (
        <button
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-surface-2"
          onClick={practice}
          type="button"
        >
          Procvičit tyto prvky ve slepé tabulce
        </button>
      )}
    </>
  );

  function practice() {
    saveElementSelection(new Set(weak.map((item) => item.elementId)));
    router.push("/procvicovani/periodicka-tabulka");
  }

  return (
    <section
      aria-labelledby="weak-elements-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink" id="weak-elements-heading">
          K zopakování
        </h2>
        {compact && weak.length > 0 ? action : null}
      </div>
      {weak.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{emptyText}</p>
      ) : (
        <>
          {compact ? null : (
            <p className="mt-1 text-sm text-ink-2">
              Prvky s nejnižší úspěšností v posledních odpovědích.
            </p>
          )}
          <ul className={cn("mt-3 list-none p-0", compact ? "flex flex-wrap gap-2" : "grid gap-2")}>
            {weak.map(({ elementId, mastery }) => {
              const element = elementsById.get(elementId);
              if (!element) return null;
              const record = `${czechCount(mastery.attempts, ATTEMPT_FORMS)}, ${mastery.correct} správně`;
              if (compact) {
                return (
                  <li
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-bad/40 bg-bad-soft py-1 pr-3 pl-1"
                    key={elementId}
                    title={record}
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 place-items-center rounded-full bg-surface font-display text-sm font-bold text-bad"
                    >
                      {element.symbol}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {element.nameCs}
                      <span className="sr-only">
                        {" "}
                        ({element.symbol}): {record}
                      </span>
                    </span>
                  </li>
                );
              }
              return (
                <li className="flex items-center gap-3" key={elementId}>
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-bad/40 bg-bad-soft font-display font-bold text-bad"
                  >
                    {element.symbol}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      {element.nameCs} <span className="sr-only">({element.symbol})</span>
                    </span>
                    <span className="block text-sm text-ink-2">{record}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {compact ? null : <div className="mt-4">{action}</div>}
        </>
      )}
    </section>
  );
}
