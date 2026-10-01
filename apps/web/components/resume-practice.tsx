"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { cn } from "@/lib/class-names";
import { listResumableExercises } from "@/lib/practice-checkpoints";
import { queryKeys } from "@/lib/query-keys";

/** Unfinished exercises saved on this device; the first one gets the only filled button. */
export function ResumePractice({ userId }: Readonly<{ userId: string }>) {
  const exercises = useQuery({
    queryKey: queryKeys.me.practiceCheckpoints(userId),
    queryFn: () => listResumableExercises(indexedDB, userId),
    retry: false,
  });
  const items = exercises.data ?? [];
  if (items.length === 0) return null;

  const [latest, ...others] = items;
  if (!latest) return null;

  return (
    <section
      aria-labelledby="resume-heading"
      className="rounded-2xl border border-accent/30 bg-accent-soft p-5 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink" id="resume-heading">
        Rozpracované cvičení
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-48 flex-1">
          <p className="font-semibold text-ink">{latest.title}</p>
          <p className="text-sm text-ink-2">
            <span className="font-semibold tabular-nums">
              {latest.answered} z {latest.total}
            </span>{" "}
            · {latest.detail}
          </p>
          <div
            aria-hidden="true"
            className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-surface"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(100 * latest.answered) / latest.total}%` }}
            />
          </div>
        </div>
        <Link
          className={cn(
            "inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-semibold text-on-fill",
          )}
          href={latest.href}
        >
          Pokračovat<span className="sr-only">: {latest.title}</span>
        </Link>
      </div>
      {others.length > 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          Další rozpracovaná cvičení:{" "}
          {others.map((item, index) => (
            <span key={item.kind}>
              {index > 0 ? " · " : null}
              <Link className="font-semibold text-accent-strong underline" href={item.href}>
                {item.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
