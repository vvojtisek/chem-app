import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowRightIcon } from "@/components/icons";
import type { PracticeArea } from "@/lib/learning-summary";
import { practiceCategories } from "@/lib/practice-catalog";

/**
 * One card per practice area: the main action as the only filled button at the bottom,
 * with other exercises and study pages as a short list of links. `progress` replaces
 * the description when known.
 */
export function PracticeCategoryList({
  progress,
}: Readonly<{ progress?: Partial<Record<PracticeArea, ReactNode>> | undefined }>) {
  return (
    <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {practiceCategories.map((category) => {
        const primary = category.links.find((link) => link.primary);
        const secondary = category.links.filter((link) => !link.primary);
        return (
          <li
            className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5"
            key={category.area}
          >
            <h3 className="font-display text-lg font-bold text-ink">{category.title}</h3>
            <p className="mt-1 leading-6 text-ink-2">
              {progress?.[category.area] ?? category.description}
            </p>
            {secondary.length > 0 ? (
              <ul className="mt-3 grid list-none gap-0.5 p-0">
                {secondary.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-accent-strong underline-offset-4 transition-colors hover:bg-accent-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-accent-soft"
                      href={link.href}
                      rel={link.target === "_blank" ? "noreferrer" : undefined}
                      target={link.target}
                    >
                      {link.label}
                      <ArrowRightIcon className="text-sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {primary ? (
              <div className="mt-auto pt-4">
                <Link
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-center text-sm font-semibold text-on-fill hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-accent-strong"
                  href={primary.href}
                >
                  {primary.label}
                </Link>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
