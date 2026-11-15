"use client";

import { type ReactNode, useEffect, useState } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/local-preferences";

function seenKey(id: string): string {
  return `inorganic.howItWorks.${id}`;
}

/**
 * Exercise instructions behind a „Jak to funguje“ disclosure. It opens by itself the first time
 * a learner sees these instructions on this device and stays collapsed afterwards, so returning
 * learners go straight to practice (device-local preference, ADR 0003).
 */
export function HowItWorks({
  id,
  children,
  className,
}: Readonly<{ id: string; children: ReactNode; className?: string }>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readStoredJson(seenKey(id)) === true) return;
    setOpen(true);
    writeStoredJson(seenKey(id), true);
  }, [id]);

  return (
    <details
      className={className}
      data-how-it-works={id}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-accent-strong">
        Jak to funguje
      </summary>
      <div className="mt-1 text-sm leading-6 text-ink-2">{children}</div>
    </details>
  );
}
