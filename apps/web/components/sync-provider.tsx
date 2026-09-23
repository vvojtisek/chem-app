"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { runAttemptSync } from "@/lib/sync/attempt-sync";
import { pendingCount } from "@/lib/sync/sync-store";

type SyncState = "synced" | "pending" | "offline" | "error";
interface SyncContextValue {
  readonly pending: number;
  readonly running: boolean;
  readonly label: string;
  readonly error: string | null;
  readonly run: () => Promise<void>;
}
const SyncContext = createContext<SyncContextValue>({
  pending: 0,
  running: false,
  label: "Synchronizace se připravuje",
  error: null,
  run: async () => {},
});

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

export function SyncStatusIndicator() {
  const sync = useSync();
  return (
    <span aria-live="polite" className="text-slate-600">
      {sync.label}
    </span>
  );
}

export function SyncProvider({
  userId,
  children,
}: Readonly<{ userId: string; children: ReactNode }>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [state, setState] = useState<SyncState>("pending");
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const active = useRef(false);
  const rerun = useRef(false);

  const run = useCallback(async () => {
    if (active.current) {
      rerun.current = true;
      return;
    }
    active.current = true;
    setRunning(true);
    setErrorMessage(null);
    try {
      const initial = await pendingCount(indexedDB, userId);
      setPending(initial);
      if (!navigator.onLine) {
        setState("offline");
        return;
      }
      await runAttemptSync(indexedDB, userId);
      const remaining = await pendingCount(indexedDB, userId);
      setPending(remaining);
      setState(remaining > 0 ? "pending" : "synced");
    } catch (error) {
      setState("error");
      setPending(await pendingCount(indexedDB, userId).catch(() => 0));
      setErrorMessage(
        error instanceof ApiError && error.code === "idempotency_conflict"
          ? "Server odmítl pokus se stejným ID a jiným obsahem. Lokální pokus zůstal uložený; obraťte se na správce."
          : "Synchronizace se nepodařila. Pokusy zůstaly na tomto zařízení a můžete ji opakovat.",
      );
      if (error instanceof ApiError && error.status === 401) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      }
    } finally {
      active.current = false;
      setRunning(false);
      if (rerun.current) {
        rerun.current = false;
        window.setTimeout(() => void run(), 0);
      }
    }
  }, [queryClient, userId]);

  useEffect(() => {
    void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onRun = () => void run();
    window.addEventListener("online", onRun);
    window.addEventListener("offline", onRun);
    window.addEventListener("focus", onRun);
    window.addEventListener("inorganic:attempt-saved", onRun);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onRun, 5 * 60_000);
    return () => {
      window.removeEventListener("online", onRun);
      window.removeEventListener("offline", onRun);
      window.removeEventListener("focus", onRun);
      window.removeEventListener("inorganic:attempt-saved", onRun);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [run]);

  const label =
    state === "offline"
      ? `Offline · čeká ${pending}`
      : state === "error"
        ? `Chyba synchronizace · čeká ${pending}`
        : running
          ? "Synchronizuji…"
          : pending > 0
            ? `Čeká ${pending}`
            : "Synchronizováno";
  return (
    <SyncContext.Provider value={{ pending, running, label, error: errorMessage, run }}>
      {children}
    </SyncContext.Provider>
  );
}
