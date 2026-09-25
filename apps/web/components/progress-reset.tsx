"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAccount, useCapabilities } from "@/components/auth-gate";
import { resetMyProgress } from "@/lib/api/client";
import { updateAccountMarkerProgressGeneration } from "@/lib/auth/account-marker";
import { queryKeys } from "@/lib/query-keys";
import { reconcileProgressGeneration } from "@/lib/sync/sync-store";

export function ProgressReset() {
  const account = useAccount();
  const { canViewProgress } = useCapabilities();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  if (!account || !canViewProgress) return null;

  async function reset() {
    if (!account || !navigator.onLine || busy) {
      setError("Reset pokroku vyžaduje připojení k internetu. Zkuste to znovu po připojení.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const generation = await resetMyProgress();
      await reconcileProgressGeneration(indexedDB, account.id, generation);
      updateAccountMarkerProgressGeneration(account.id, generation);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me.stats });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me.attemptStats(account.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me.periodicMastery(account.id) });
      window.location.reload();
    } catch {
      setError(
        "Reset se nepodařilo dokončit. Obnovte stránku; stav účtu se po připojení znovu ověří.",
      );
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="progress-reset-heading"
      className="mt-6 rounded-2xl border border-rose-200 bg-white p-5"
    >
      <h2 id="progress-reset-heading" className="text-lg font-semibold text-slate-950">
        Reset pokroku
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        Vynuluje zobrazovanou historii pokusů, úroveň a rozpracovaná cvičení na všech zařízeních po
        jejich synchronizaci. Účet, nastavení a vlastní karty zůstanou zachované. Starší pokusy
        zůstanou na serveru pro evidenci denního limitu, ale nebudou se zobrazovat.
      </p>
      {!confirming ? (
        <button
          className="mt-4 min-h-11 rounded-xl border border-rose-300 px-4 text-rose-900"
          onClick={() => {
            setConfirming(true);
            setError("");
            window.setTimeout(() => confirmRef.current?.focus(), 0);
          }}
          type="button"
        >
          Resetovat pokrok
        </button>
      ) : (
        <fieldset className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4">
          <legend className="sr-only">Potvrzení resetu pokroku</legend>
          <p className="font-medium text-rose-950">Opravdu chcete vynulovat celý osobní pokrok?</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              ref={confirmRef}
              disabled={busy}
              className="min-h-11 rounded-xl bg-rose-800 px-4 text-white disabled:opacity-50"
              onClick={() => void reset()}
              type="button"
            >
              Ano, resetovat pokrok
            </button>
            <button
              disabled={busy}
              className="min-h-11 rounded-xl border px-4"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              type="button"
            >
              Zrušit
            </button>
          </div>
        </fieldset>
      )}
      {busy ? (
        <p className="mt-3 text-sm" role="status">
          Resetuji pokrok…
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
