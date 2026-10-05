"use client";

import { curatedElements } from "@inorganic/content/runtime";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAccount, useCapabilities } from "@/components/auth-gate";
import { ResumePractice } from "@/components/resume-practice";
import { WeakElements } from "@/components/weak-elements";
import { getMyProfile } from "@/lib/api/client";
import { createBrowserProgressStore, type AttemptEvent } from "@/lib/browser-progress-store";
import { czechCount, formatAccuracy } from "@/lib/czech-plural";
import { cacheDailyGoal, countDailyAnswers, readCachedDailyGoal } from "@/lib/daily-goal";
import { summarizeAreas } from "@/lib/learning-summary";
import { calculatePeriodicTableMastery } from "@/lib/periodic-table-mastery";
import { practiceCategories } from "@/lib/practice-catalog";
import { queryKeys } from "@/lib/query-keys";

const ANSWER_FORMS = ["odpověď", "odpovědi", "odpovědí"] as const;

function DailyGoal({
  userId,
  attempts,
  serverGoal,
}: Readonly<{
  userId: string;
  attempts: readonly AttemptEvent[];
  serverGoal: number | null | undefined;
}>) {
  const [cachedGoal, setCachedGoal] = useState<number | null>(null);
  useEffect(() => setCachedGoal(readCachedDailyGoal(userId)), [userId]);
  useEffect(() => {
    if (serverGoal !== undefined) {
      cacheDailyGoal(userId, serverGoal);
      setCachedGoal(serverGoal);
    }
  }, [serverGoal, userId]);
  const goal = serverGoal === undefined ? cachedGoal : serverGoal;
  const answers = countDailyAnswers(attempts, new Date());

  return (
    <section
      aria-labelledby="daily-goal-heading"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink" id="daily-goal-heading">
        Dnešní cíl
      </h2>
      {goal === null ? (
        <p className="mt-3 text-ink-2">
          Dnes {czechCount(answers, ANSWER_FORMS)}.{" "}
          <Link className="font-semibold text-accent-strong underline" href="/ucet">
            Nastavit denní cíl v profilu
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums text-ink">
            {Math.min(Math.round((answers / goal) * 100), 100)} %
          </p>
          <p className="text-sm text-ink-2">
            {answers} z {goal} odpovědí · počítají se i chybné odpovědi
          </p>
          <progress
            aria-label="Dnešní cíl"
            className="mt-3 h-2 w-full accent-accent"
            max={goal}
            value={Math.min(answers, goal)}
          />
          {answers >= goal ? (
            <p className="mt-2 text-sm font-semibold text-good">Dnešní cíl splněn</p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Account progress from this device is shown immediately, including answers awaiting sync. */
export function HomeDashboard() {
  const account = useAccount();
  const { canSave, canViewProgress } = useCapabilities();
  const userId = account?.id;
  const profile = useQuery({
    queryKey: queryKeys.me.profile,
    queryFn: getMyProfile,
    enabled: Boolean(userId && canViewProgress),
    retry: false,
  });
  const attempts = useQuery({
    queryKey: queryKeys.me.periodicMastery(userId ?? ""),
    queryFn: () => createBrowserProgressStore(indexedDB, userId).listAttempts(),
    enabled: Boolean(userId && canViewProgress),
    retry: false,
  });
  const progress = useMemo(() => {
    const all = attempts.data ?? [];
    const summary = summarizeAreas(all);
    const mastery = calculatePeriodicTableMastery(all);
    const mastered = curatedElements.filter(
      (element) => mastery.get(element.id)?.level === "mastered",
    ).length;
    return { summary, mastered };
  }, [attempts.data]);

  return (
    <>
      <h1 className="mb-6 break-words font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Dobrý den
        {account?.role === "guest"
          ? ""
          : `, ${profile.data?.displayName?.trim() || account?.username || ""}`}
      </h1>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,1fr)]">
        {userId && canSave ? <ResumePractice userId={userId} /> : null}
        {userId && canViewProgress ? (
          <DailyGoal
            attempts={attempts.data ?? []}
            serverGoal={profile.data?.dailyGoal}
            userId={userId}
          />
        ) : null}
      </div>
      <section aria-labelledby="areas-heading" className="mt-6">
        <h2 className="sr-only" id="areas-heading">
          Oblasti učení
        </h2>
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {practiceCategories.map((category) => {
            const stats = progress.summary[category.area];
            const accuracy = formatAccuracy(stats.correct, stats.attempts);
            const isPeriodic = category.area === "periodic";
            const caption =
              !canViewProgress || !attempts.data
                ? category.description
                : isPeriodic
                  ? `${progress.mastered} ze ${curatedElements.length} prvků zvládnuto · ${czechCount(stats.attempts, ANSWER_FORMS)}`
                  : accuracy
                    ? `Úspěšnost ${accuracy} · ${czechCount(stats.attempts, ANSWER_FORMS)}`
                    : "Zatím bez odpovědí";
            const percentage = isPeriodic
              ? Math.round((progress.mastered / curatedElements.length) * 100)
              : stats.attempts > 0
                ? Math.round((stats.correct / stats.attempts) * 100)
                : 0;
            return (
              <li
                className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
                key={category.area}
              >
                <h3 className="font-display text-lg font-bold text-ink">{category.title}</h3>
                {canViewProgress && attempts.data ? (
                  <div
                    aria-hidden="true"
                    className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                ) : null}
                <p className="mt-2 min-h-12 text-sm leading-6 text-ink-2">{caption}</p>
                <ul className="mt-3 list-none p-0">
                  {category.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        className="inline-flex min-h-9 items-center text-sm font-semibold text-accent-strong hover:underline"
                        href={link.href}
                      >
                        {link.label} <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
          <li className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <h3 className="font-display text-lg font-bold text-ink">Učivo</h3>
            <p className="mt-3 min-h-14 text-sm leading-6 text-ink-2">
              Bez otázek a bez hodnocení. Procházejte prvky, jejich přípravu a výrobu.
            </p>
            <ul className="list-none p-0">
              <li>
                <Link
                  className="inline-flex min-h-9 items-center text-sm font-semibold text-accent-strong hover:underline"
                  href="/uceni/karty-prvku"
                >
                  Karty prvků <span aria-hidden="true">→</span>
                </Link>
              </li>
              <li>
                <Link
                  className="inline-flex min-h-9 items-center text-sm font-semibold text-accent-strong hover:underline"
                  href="/uceni/prvky"
                >
                  Prvky a skupiny <span aria-hidden="true">→</span>
                </Link>
              </li>
              <li>
                <Link
                  className="inline-flex min-h-9 items-center text-sm font-semibold text-accent-strong hover:underline"
                  href="/uceni/priprava-vyroba"
                >
                  Příprava a výroba <span aria-hidden="true">→</span>
                </Link>
              </li>
              <li>
                <Link
                  className="inline-flex min-h-9 items-center text-sm font-semibold text-accent-strong hover:underline"
                  href="/uceni/prvky/vycislovani-rovnic"
                >
                  Vyčíslování rovnic <span aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          </li>
        </ul>
      </section>
      {userId && canViewProgress ? (
        <div className="mt-6">
          <WeakElements compact userId={userId} />
        </div>
      ) : null}
    </>
  );
}
