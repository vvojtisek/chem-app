"use client";

import { curatedElements } from "@inorganic/content/runtime";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAccount, useCapabilities } from "@/components/auth-gate";
import { PracticeCategoryList } from "@/components/practice-category-list";
import { ResumePractice } from "@/components/resume-practice";
import { WeakElements } from "@/components/weak-elements";
import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import { czechCount, formatAccuracy } from "@/lib/czech-plural";
import { type AreaSummary, summarizeAreas } from "@/lib/learning-summary";
import { calculatePeriodicTableMastery } from "@/lib/periodic-table-mastery";
import { queryKeys } from "@/lib/query-keys";

const ANSWER_FORMS = ["odpověď", "odpovědi", "odpovědí"] as const;

function describeArea(summary: AreaSummary): string | undefined {
  const accuracy = formatAccuracy(summary.correct, summary.attempts);
  return accuracy
    ? `Úspěšnost ${accuracy} · ${czechCount(summary.attempts, ANSWER_FORMS)}`
    : undefined;
}

/**
 * The home screen: unfinished exercises first, then every practice area with its progress from
 * this device, then the elements that need review. Guests and testers see the areas only.
 */
export function HomeDashboard() {
  const account = useAccount();
  const { canSave, canViewProgress } = useCapabilities();
  const userId = account?.id;
  const attempts = useQuery({
    queryKey: queryKeys.me.periodicMastery(userId ?? ""),
    queryFn: () => createBrowserProgressStore(indexedDB, userId).listAttempts(),
    enabled: Boolean(userId && canViewProgress),
    retry: false,
  });

  const progress = useMemo(() => {
    if (!attempts.data) return undefined;
    const summary = summarizeAreas(attempts.data);
    const mastery = calculatePeriodicTableMastery(attempts.data);
    const mastered = curatedElements.filter(
      (element) => mastery.get(element.id)?.level === "mastered",
    ).length;
    const periodic = describeArea(summary.periodic);
    return {
      periodic: periodic
        ? `${mastered} ze ${curatedElements.length} prvků zvládnuto · ${periodic}`
        : undefined,
      equations: describeArea(summary.equations),
      nomenclature: describeArea(summary.nomenclature),
    };
  }, [attempts.data]);

  return (
    <>
      {userId && canSave ? <ResumePractice userId={userId} /> : null}
      <section aria-label="Režimy procvičování">
        <PracticeCategoryList progress={progress} />
      </section>
      {userId && canViewProgress ? (
        <div className="mt-6">
          <WeakElements compact userId={userId} />
        </div>
      ) : null}
    </>
  );
}
