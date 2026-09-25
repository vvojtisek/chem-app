"use client";

import Link from "next/link";
import { useAccount, useCapabilities } from "./auth-gate";
import { SyncStatusIndicator } from "./sync-provider";

export function AccountNavigation() {
  const account = useAccount();
  const { canSync, isGuest } = useCapabilities();
  if (!account) return null;
  return (
    <nav
      aria-label="Navigace účtu"
      className="sticky top-0 z-30 flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 text-sm backdrop-blur sm:gap-3 sm:px-8"
    >
      {isGuest ? (
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
          Host · jen pro čtení
        </span>
      ) : account.role === "tester" ? (
        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
          Testovací účet
        </span>
      ) : null}
      {canSync ? <SyncStatusIndicator /> : null}
      <Link className="min-h-10 rounded-lg px-2 py-2 underline" href="/">
        Domů
      </Link>
      <Link
        className="min-h-10 rounded-lg px-2 py-2 underline"
        href="/uceni/prvky"
        rel="noreferrer"
        target="_blank"
      >
        Učivo
      </Link>
      <Link className="min-h-10 rounded-lg px-2 py-2 underline" href="/pokrok">
        Pokrok
      </Link>
      <Link className="min-h-10 rounded-lg px-2 py-2 underline" href="/napoveda">
        Nápověda
      </Link>
      {account.role === "admin" ? (
        <Link className="underline" href="/admin">
          Správa
        </Link>
      ) : null}
      <Link aria-label="Profil" className="min-h-10 rounded-lg px-2 py-2 underline" href="/ucet">
        {isGuest ? "Host" : "Profil"}
      </Link>
    </nav>
  );
}
