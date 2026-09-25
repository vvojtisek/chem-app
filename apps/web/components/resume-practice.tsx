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

  return (
    <section
      aria-labelledby="resume-heading"
      className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft p-5 sm:p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink" id="resume-heading">
        {items.length === 1 ? "Rozpracované cvičení" : "Rozpracovaná cvičení"}
      </h2>
      <ul className="mt-3 grid list-none gap-3 p-0">
        {items.map((item, index) => (
          <li className="flex flex-wrap items-center gap-x-4 gap-y-2" key={item.kind}>
            <div className="min-w-48 flex-1">
              <p className="font-semibold text-ink">{item.title}</p>
              <p className="text-sm text-ink-2">
                <span className="font-semibold tabular-nums">
                  {item.answered} z {item.total}
                </span>{" "}
                · {item.detail}
              </p>
              <div
                aria-hidden="true"
                className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-surface"
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(100 * item.answered) / item.total}%` }}
                />
              </div>
            </div>
            <Link
              className={cn(
                "inline-flex min-h-11 items-center rounded-xl px-4 font-semibold",
                index === 0
                  ? "bg-accent text-on-fill"
                  : "border border-line-strong bg-surface text-ink",
              )}
              href={item.href}
            >
              Pokračovat<span className="sr-only">: {item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
