"use client";

import { useQuery } from "@tanstack/react-query";
import { PageNavigation } from "@/components/page-navigation";
import { ProgressionPanel } from "@/components/progression-panel";
import { useAccount } from "@/components/auth-gate";
import { getMyProgression } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export default function ProgressPage() {
  const account = useAccount();
  const isGuest = account?.role === "guest";
  const isTester = account?.role === "tester";
  const progression = useQuery({
    queryKey: queryKeys.me.stats,
    queryFn: getMyProgression,
    enabled: Boolean(account && !isGuest && !isTester),
  });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageNavigation />
      <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
        Osobní přehled
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        Dashboard s pokrokem
      </h1>
      {isGuest ? (
        <p className="mt-5 rounded-2xl border bg-white p-5 text-slate-700">
          Hostovský přístup nezaznamenává osobní pokusy. Pro zobrazení vlastního pokroku se
          přihlaste k účtu.
        </p>
      ) : isTester ? (
        <p className="mt-5 rounded-2xl border bg-white p-5 text-slate-700">
          Testovací účet nemá osobní statistiky pokroku.
        </p>
      ) : (
        <ProgressionPanel progression={progression.data} isLoading={progression.isPending} />
      )}
    </main>
  );
}
