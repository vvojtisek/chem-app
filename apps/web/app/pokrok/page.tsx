"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { ModeStatsPanel } from "@/components/mode-stats-panel";
import { PageHeader } from "@/components/page-header";
import { PeriodicMasteryHeatmap } from "@/components/periodic-mastery-heatmap";
import { ProgressionPanel } from "@/components/progression-panel";
import { useSync } from "@/components/sync-provider";
import { WeakElements } from "@/components/weak-elements";
import { getMyAttemptStats, getMyProgression } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export default function ProgressPage() {
  const account = useAccount();
  const { canViewProgress } = useCapabilities();
  const isGuest = account?.role === "guest";
  const isTester = account?.role === "tester";
  const queryClient = useQueryClient();
  const { running } = useSync();
  const wasSyncRunning = useRef(running);
  const progression = useQuery({
    queryKey: queryKeys.me.stats,
    queryFn: getMyProgression,
    enabled: Boolean(account && canViewProgress),
  });
  const attemptStats = useQuery({
    queryKey: queryKeys.me.attemptStats(account?.id ?? ""),
    queryFn: getMyAttemptStats,
    enabled: Boolean(account && canViewProgress),
  });

  useEffect(() => {
    if (wasSyncRunning.current && !running && account && !isGuest && !isTester) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.attemptStats(account.id) });
    }
    wasSyncRunning.current = running;
  }, [running, account, isGuest, isTester, queryClient]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader title="Pokrok" />
      {isGuest ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-2">
          Hostovský přístup nezaznamenává osobní pokusy. Pro zobrazení vlastního pokroku se
          přihlaste k účtu.
        </p>
      ) : isTester ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-2">
          Testovací účet nemá osobní statistiky pokroku.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <ProgressionPanel progression={progression.data} isLoading={progression.isPending} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <ModeStatsPanel stats={attemptStats.data} isLoading={attemptStats.isPending} />
            {account ? (
              <WeakElements
                emptyText="Zatím žádný prvek nepotřebuje opakování. Hodnocení začíná po třech pokusech o prvek."
                userId={account.id}
              />
            ) : null}
          </div>
          {account ? <PeriodicMasteryHeatmap userId={account.id} /> : null}
        </div>
      )}
    </main>
  );
}
