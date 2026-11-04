"use client";

import { type ReactNode, useId, useState } from "react";

import { Formula } from "@/components/formula";

/** „Nápověda“ toggles a hint below the buttons; „Přeskočit“ moves the question to the end. */
export function QuestionTools({
  hint,
  onSkip,
}: Readonly<{ hint: ReactNode; onSkip: (() => void) | undefined }>) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  return (
    <div className="mt-3">
      <div className="flex flex-wrap justify-center gap-2">
        {hint ? (
          <button
            aria-controls={hintId}
            aria-expanded={open}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-3"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? "Skrýt nápovědu" : "Nápověda"}
          </button>
        ) : null}
        {onSkip ? (
          <button
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-3"
            onClick={onSkip}
            type="button"
          >
            Přeskočit
          </button>
        ) : null}
      </div>
      {hint && open ? (
        <p
          className="mt-3 rounded-xl bg-surface-2 p-3 text-center text-sm leading-6 text-ink"
          id={hintId}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A substance as „name (formula)“, or the formula alone when the curriculum has no name. */
export function NamedSubstance({
  formula,
  nameCs,
}: Readonly<{ formula: string; nameCs: string | null }>) {
  return nameCs ? (
    <>
      {nameCs.toLocaleLowerCase("cs")} (<Formula formula={formula} />)
    </>
  ) : (
    <Formula formula={formula} />
  );
}
