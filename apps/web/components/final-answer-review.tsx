"use client";

import { type ReactNode, useEffect, useRef } from "react";

/** Completion is a separate learner action; evaluating the last answer never hides it. */
export function FinalAnswerReview({
  children,
  onShowResults,
}: Readonly<{
  children: ReactNode;
  onShowResults: () => void;
}>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => buttonRef.current?.focus(), []);
  return (
    <section aria-label="Poslední odpověď" className="mt-4" aria-live="polite">
      <h2 className="font-display text-xl font-bold text-ink">Vyhodnocení poslední otázky</h2>
      {children}
      <button
        ref={buttonRef}
        className="mt-4 min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-fill"
        onClick={onShowResults}
        type="button"
      >
        Zobrazit výsledky
      </button>
    </section>
  );
}
