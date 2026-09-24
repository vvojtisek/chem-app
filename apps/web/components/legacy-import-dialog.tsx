"use client";

import { useEffect, useRef, useState } from "react";
import {
  importLegacyData,
  keepLegacyOutsideAccount,
  legacyAttemptCount,
} from "@/lib/legacy-import";
import { useAccount } from "./auth-gate";

export function LegacyImportDialog() {
  const account = useAccount();
  const userId = account?.id;
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const firstButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!userId) return;
    void legacyAttemptCount(indexedDB, userId)
      .then(setCount)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Starší data nelze načíst."),
      );
  }, [userId]);
  useEffect(() => {
    if (count !== null) firstButton.current?.focus();
  }, [count]);
  if (!account || count === null) return null;
  async function decide(importData: boolean) {
    if (!account) return;
    setBusy(true);
    setError("");
    try {
      if (importData) await importLegacyData(indexedDB, account.id);
      else await keepLegacyOutsideAccount(indexedDB, account.id);
      setCount(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Převod se nepodařil.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      aria-labelledby="legacy-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold" id="legacy-title">
          Starší lokální data
        </h2>
        <p className="mt-3">
          Na tomto zařízení je {count} pokusů z doby před přihlášením. Chcete je převést do účtu{" "}
          {account.username}? Převedou se také místní karty a rozpracované cvičení.
        </p>
        <p aria-live="polite" className="mt-2 text-rose-800">
          {error}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            ref={firstButton}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-white"
            disabled={busy}
            onClick={() => void decide(true)}
            type="button"
          >
            Převést do účtu
          </button>
          <button
            className="min-h-11 rounded-xl border px-4"
            disabled={busy}
            onClick={() => void decide(false)}
            type="button"
          >
            Ponechat mimo účet
          </button>
        </div>
      </div>
    </div>
  );
}
