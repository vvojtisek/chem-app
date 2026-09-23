"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/components/auth-gate";
import { useSync } from "@/components/sync-provider";
import { logout } from "@/lib/api/client";
import { clearAccountMarker } from "@/lib/auth/account-marker";
import { resetLearningDatabase } from "@/lib/browser-learning-database";
import { pendingCount } from "@/lib/sync/sync-store";

export default function AccountPage() {
  const account = useAccount();
  const sync = useSync();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!account) return null;

  async function signOut(clearData: boolean) {
    if (!account) return;
    setBusy(true);
    setError("");
    try {
      if (clearData) {
        const pending = await pendingCount(indexedDB, account.id);
        const confirmed = window.confirm(
          pending > 0
            ? `Na odeslání čeká ${pending} pokusů. Jejich smazání může být nevratné. Opravdu smazat data tohoto účtu ze zařízení?`
            : "Opravdu smazat lokální karty, rozpracovaná cvičení a pokusy tohoto účtu ze zařízení?",
        );
        if (!confirmed) return;
        await resetLearningDatabase(indexedDB, account.id);
      }
      await logout();
      clearAccountMarker();
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Odhlášení se nepodařilo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-semibold">Účet</h1>
      <dl className="mt-6 grid gap-2">
        <div>
          <dt className="font-medium">Jméno</dt>
          <dd>{account.username}</dd>
        </div>
        <div>
          <dt className="font-medium">Role</dt>
          <dd>
            {account.role === "admin"
              ? "Správce"
              : account.role === "tester"
                ? "Testovací účet"
                : "Uživatel"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Synchronizace</dt>
          <dd>{sync.label}</dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-col gap-3">
        <button
          className="min-h-11 rounded-xl border px-4 text-left"
          disabled={busy || sync.running}
          onClick={() => void sync.run()}
          type="button"
        >
          Synchronizovat nyní
        </button>
        <button
          className="min-h-11 rounded-xl border px-4 text-left"
          disabled={busy || sync.running}
          onClick={() => void signOut(false)}
          type="button"
        >
          Odhlásit
        </button>
        <button
          className="min-h-11 rounded-xl border border-rose-300 px-4 text-left text-rose-900"
          disabled={busy || sync.running}
          onClick={() => void signOut(true)}
          type="button"
        >
          Odhlásit a smazat data z tohoto zařízení
        </button>
      </div>
      {sync.pending > 0 ? (
        <p className="mt-4 text-sm text-amber-900">
          Na odeslání čeká {sync.pending} pokusů. Smazání dat je nevratně odstraní z tohoto
          zařízení.
        </p>
      ) : null}
      {sync.error ? (
        <p role="alert" className="mt-4 text-rose-800">
          {sync.error}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-4 text-rose-800">
        {error}
      </p>
    </main>
  );
}
