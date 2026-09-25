"use client";

import { curatedElements } from "@inorganic/content/runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { createBrowserProgressStore } from "@/lib/browser-progress-store";
import { createPeriodicTableLayout } from "@/lib/periodic-table-layout";
import {
  calculatePeriodicTableMastery,
  type MasteryLevel,
  MIN_MASTERY_ATTEMPTS,
  masteryForElement,
} from "@/lib/periodic-table-mastery";
import { queryKeys } from "@/lib/query-keys";
import { PeriodicTableFrame } from "./periodic-table-grid";
import { useSync } from "./sync-provider";

const layout = createPeriodicTableLayout(curatedElements);

const LEVELS: Readonly<Record<MasteryLevel, { label: string; mark: string; style: string }>> = {
  "no-data": {
    label: "Bez dat",
    mark: "—",
    style: "border border-line-strong bg-surface-2 text-ink-2",
  },
  starting: {
    label: "Zatím málo pokusů",
    mark: "·",
    style: "border border-dashed border-accent bg-accent-soft text-ink",
  },
  low: {
    label: "K procvičení",
    mark: "1",
    style: "border border-bad bg-bad-soft text-bad",
  },
  developing: {
    label: "Na cestě",
    mark: "2",
    style: "border border-warn bg-warn-soft text-warn",
  },
  mastered: {
    label: "Zvládnuté",
    mark: "✓",
    style: "border border-good bg-good-soft text-good",
  },
};

export function PeriodicMasteryHeatmap({ userId }: Readonly<{ userId: string }>) {
  const queryClient = useQueryClient();
  const { running } = useSync();
  const wasSyncRunning = useRef(running);
  const queryKey = useMemo(() => queryKeys.me.periodicMastery(userId), [userId]);
  const attempts = useQuery({
    queryKey,
    queryFn: () => createBrowserProgressStore(indexedDB, userId).listAttempts(),
    retry: false,
  });
  const mastery = useMemo(
    () => calculatePeriodicTableMastery(attempts.data ?? []),
    [attempts.data],
  );
  const studiedCount = curatedElements.filter((element) => mastery.has(element.id)).length;

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    window.addEventListener("inorganic:attempt-saved", refresh);
    return () => window.removeEventListener("inorganic:attempt-saved", refresh);
  }, [queryClient, queryKey]);

  useEffect(() => {
    if (wasSyncRunning.current && !running) {
      void queryClient.invalidateQueries({ queryKey });
    }
    wasSyncRunning.current = running;
  }, [running, queryClient, queryKey]);

  return (
    <section aria-labelledby="mastery-heading" className="mt-6 rounded-2xl border bg-surface p-5">
      <h2 className="text-xl font-semibold" id="mastery-heading">
        Zvládnutí periodické tabulky
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        Přehled vychází z pokusů uložených na tomto zařízení. Funguje i bez připojení a po
        synchronizaci se doplní pokusy z dalších zařízení.
      </p>
      {attempts.isPending ? <p role="status">Načítám místní pokusy…</p> : null}
      {attempts.isError ? (
        <p role="alert">Místní pokusy se nepodařilo načíst. Zkuste stránku obnovit.</p>
      ) : null}
      {attempts.isSuccess ? (
        <>
          <p className="mt-3 text-sm text-ink-2" role="status">
            {studiedCount === 0
              ? "Zatím nemáte žádné pokusy z periodické tabulky."
              : `Procvičené prvky: ${studiedCount} z ${curatedElements.length}.`}
          </p>
          <ul aria-label="Legenda zvládnutí" className="mt-4 flex flex-wrap gap-3 text-sm">
            {(Object.keys(LEVELS) as MasteryLevel[]).map((level) => (
              <li className="flex items-center gap-2" key={level}>
                <span
                  aria-hidden="true"
                  className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded ${LEVELS[level].style}`}
                >
                  {LEVELS[level].mark}
                </span>
                <span>{LEVELS[level].label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-2">
            Hodnocení začíná po {MIN_MASTERY_ATTEMPTS} pokusech o prvek. Novější odpovědi mají větší
            váhu; značka v každém políčku opakuje úroveň bez barvy.
          </p>
          <PeriodicTableFrame
            layout={layout}
            legend="Zvládnutí prvků periodické tabulky"
            renderCell={({ element, position }) => {
              const state = masteryForElement(mastery, element.id);
              const level = LEVELS[state.level];
              return (
                <div
                  aria-label={`${element.nameCs} (${element.symbol}): ${level.label}, počet pokusů: ${state.attempts}`}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-md text-xs font-semibold ${level.style}`}
                  role="img"
                  style={{
                    gridColumn: position.column,
                    gridRow: position.section === "main" ? position.row : 1,
                  }}
                >
                  <span aria-hidden="true">{element.symbol}</span>
                  <span aria-hidden="true">{level.mark}</span>
                </div>
              );
            }}
          />
        </>
      ) : null}
    </section>
  );
}
