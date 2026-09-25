"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { ApiError, type CurrentUser, getCurrentUser } from "@/lib/api/client";
import {
  clearAccountMarker,
  readAccountMarker,
  saveAccountMarker,
} from "@/lib/auth/account-marker";
import { copyLegacyPeriodicCheckpoints } from "@/lib/browser-periodic-session-store";
import { queryKeys } from "@/lib/query-keys";
import { reconcileProgressGeneration } from "@/lib/sync/sync-store";
import { AppShell } from "./app-shell";
import { LegacyImportDialog } from "./legacy-import-dialog";
import { SyncProvider } from "./sync-provider";

export type ActiveAccount = Pick<CurrentUser, "id" | "username" | "role" | "progressGeneration">;
const AccountContext = createContext<ActiveAccount | null>(null);
const publicAuthPaths = new Set(["/login", "/register", "/reset-password", "/verify-email"]);

function AuthenticatedShell({
  account,
  children,
  offline = false,
}: Readonly<{ account: ActiveAccount; children: ReactNode; offline?: boolean }>) {
  const notice = offline ? (
    <p className="border-b border-warn/40 bg-warn-soft px-4 py-2 text-sm text-warn" role="status">
      Síťové ověření není dostupné. Pokračujete s naposledy ověřeným účtem; synchronizace se obnoví
      po připojení.
    </p>
  ) : null;
  return (
    <AccountContext.Provider value={account}>
      {account.role === "guest" ? (
        <AppShell notice={notice}>{children}</AppShell>
      ) : (
        <SyncProvider userId={account.id}>
          <AppShell notice={notice}>
            <LegacyImportDialog />
            {children}
          </AppShell>
        </SyncProvider>
      )}
    </AccountContext.Provider>
  );
}

function ProgressBootstrap({
  account,
  children,
  offline,
}: Readonly<{
  account: ActiveAccount & { progressGeneration: string };
  children: ReactNode;
  offline?: boolean;
}>) {
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const key = `${account.id}:${account.progressGeneration}`;
  useEffect(() => {
    let active = true;
    setError(false);
    if (account.role === "guest") {
      setReadyKey(key);
      return () => {
        active = false;
      };
    }
    void reconcileProgressGeneration(indexedDB, account.id, account.progressGeneration)
      .then(async () => {
        await copyLegacyPeriodicCheckpoints(indexedDB, account.id, account.progressGeneration);
        if (active) setReadyKey(key);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [account.id, account.role, account.progressGeneration, key]);
  if (error)
    return (
      <p role="alert" className="p-5">
        Pokrok účtu se nepodařilo připravit. Obnovte stránku a zkuste to znovu.
      </p>
    );
  if (readyKey !== key)
    return (
      <p role="status" className="p-5">
        Připravuji osobní pokrok…
      </p>
    );
  return (
    <AuthenticatedShell account={account} {...(offline ? { offline } : {})}>
      {children}
    </AuthenticatedShell>
  );
}

export function useAccount(): ActiveAccount | null {
  return useContext(AccountContext);
}

export function useCapabilities() {
  const account = useAccount();
  const isGuest = account?.role === "guest";
  const canSave = !isGuest;
  return {
    canSave,
    canEdit: canSave,
    canManageProfile: !isGuest,
    canSync: !isGuest,
    canViewProgress: Boolean(account && !isGuest && account.role !== "tester"),
    isGuest,
  } as const;
}

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [marker, setMarker] = useState<ReturnType<typeof readAccountMarker>>(null);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);
    setMarker(readAccountMarker());
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const isPublicAuthPath = publicAuthPaths.has(pathname);
  const me = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: getCurrentUser,
    enabled: mounted && online && !isPublicAuthPath,
    staleTime: 0,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 1,
  });

  useEffect(() => {
    if (me.data) {
      saveAccountMarker(me.data);
      setMarker(readAccountMarker());
    } else if (me.error instanceof ApiError && me.error.status === 401) {
      clearAccountMarker();
      setMarker(null);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.data, me.error, pathname, router]);

  if (isPublicAuthPath) return <>{children}</>;
  if (!mounted)
    return (
      <p role="status" className="p-5">
        Ověřuji účet…
      </p>
    );
  if (me.data) return <ProgressBootstrap account={me.data}>{children}</ProgressBootstrap>;
  const networkUnavailable = !online || isNetworkUnavailable(me.error);
  if (networkUnavailable && marker) {
    return (
      <ProgressBootstrap
        account={{
          id: marker.userId,
          username: marker.username,
          role: marker.role,
          progressGeneration: marker.progressGeneration,
        }}
        offline
      >
        {children}
      </ProgressBootstrap>
    );
  }
  if (me.error instanceof ApiError && me.error.status === 401) return null;
  if (me.error) {
    return (
      <main className="mx-auto max-w-md p-5">
        <h1 className="text-2xl font-semibold">Účet se nepodařilo ověřit</h1>
        <p className="mt-3">Zkontrolujte připojení a zkuste to znovu.</p>
        <button
          className="mt-4 min-h-11 rounded-xl border px-4"
          onClick={() => void me.refetch()}
          type="button"
        >
          Zkusit znovu
        </button>
      </main>
    );
  }
  if (!online)
    return (
      <main className="p-5">
        <h1 className="text-2xl font-semibold">Je potřeba přihlášení</h1>
        <p>Pro první přihlášení se připojte k internetu.</p>
      </main>
    );
  return (
    <p role="status" className="p-5">
      Ověřuji účet…
    </p>
  );
}

function isNetworkUnavailable(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    error instanceof SyntaxError ||
    (error instanceof ApiError && error.status >= 500)
  );
}
