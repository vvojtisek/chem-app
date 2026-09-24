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
import { queryKeys } from "@/lib/query-keys";
import { AccountNavigation } from "./account-navigation";
import { LegacyImportDialog } from "./legacy-import-dialog";
import { SyncProvider } from "./sync-provider";

export type ActiveAccount = Pick<CurrentUser, "id" | "username" | "role">;
const AccountContext = createContext<ActiveAccount | null>(null);
const publicAuthPaths = new Set(["/login", "/register", "/reset-password", "/verify-email"]);

function AuthenticatedShell({
  account,
  children,
}: Readonly<{ account: ActiveAccount; children: ReactNode }>) {
  return (
    <AccountContext.Provider value={account}>
      <AccountNavigation />
      {account.role === "guest" ? (
        children
      ) : (
        <SyncProvider userId={account.id}>
          <LegacyImportDialog />
          {children}
        </SyncProvider>
      )}
    </AccountContext.Provider>
  );
}

export function useAccount(): ActiveAccount | null {
  return useContext(AccountContext);
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
  if (me.data) return <AuthenticatedShell account={me.data}>{children}</AuthenticatedShell>;
  if (!online && marker) {
    return (
      <AuthenticatedShell
        account={{ id: marker.userId, username: marker.username, role: marker.role }}
      >
        {children}
      </AuthenticatedShell>
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
