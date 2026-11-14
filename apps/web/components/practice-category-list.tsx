import Link from "next/link";
import type { ReactNode } from "react";

import type { PracticeArea } from "@/lib/learning-summary";
import { practiceCategories } from "@/lib/practice-catalog";

/**
 * One card per practice area. Every exercise is the same full-width filled button, stacked at
 * the bottom of the card so the buttons line up across a row. `progress` replaces the
 * description when known.
 */
export function PracticeCategoryList({
  progress,
}: Readonly<{ progress?: Partial<Record<PracticeArea, ReactNode>> | undefined }>) {
  return (
    <ul
      aria-label="Oblasti procvičování"
      className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      {practiceCategories.map((category) => (
        <li
          className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 sm:p-5"
          key={category.area}
        >
          <h3 className="font-display text-lg font-bold text-ink">{category.title}</h3>
          <p className="mt-1 leading-6 text-ink-2">
            {progress?.[category.area] ?? category.description}
          </p>
          <ul className="mt-auto grid list-none gap-2.5 p-0 pt-4">
            {category.links.map((link) => (
              <li key={link.href}>
                <Link
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-center text-sm font-bold text-on-fill hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-accent-strong"
                  href={link.href}
                  rel={link.target === "_blank" ? "noreferrer" : undefined}
                  target={link.target}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
