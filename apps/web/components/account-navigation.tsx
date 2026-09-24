"use client";

import Link from "next/link";
import { useAccount } from "./auth-gate";
import { SyncStatusIndicator } from "./sync-provider";

export function AccountNavigation() {
  const account = useAccount();
  if (!account) return null;
  return (
    <nav
      aria-label="Navigace účtu"
      className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-5 py-2 text-sm sm:px-8"
    >
      {account.role === "guest" ? (
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
          Host · jen pro čtení
        </span>
      ) : account.role === "tester" ? (
        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
          Testovací účet
        </span>
      ) : null}
      {account.role === "guest" ? null : <SyncStatusIndicator />}
      {account.role === "admin" ? (
        <Link className="underline" href="/admin">
          Správa
        </Link>
      ) : null}
      <Link className="underline" href="/ucet">
        {account.role === "guest" ? "Host" : account.username}
      </Link>
    </nav>
  );
}
