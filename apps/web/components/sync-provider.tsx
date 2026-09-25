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
import { updateAccountMarkerProgressGeneration } from "@/lib/auth/account-marker";
import { queryKeys } from "@/lib/query-keys";
import { runAttemptSync } from "@/lib/sync/attempt-sync";
import { pendingCount, quarantineSummary } from "@/lib/sync/sync-store";

type SyncState = "synced" | "pending" | "offline" | "error";
interface SyncContextValue {
  readonly pending: number;
  readonly running: boolean;
  readonly label: string;
  readonly error: string | null;
  readonly quarantined: number;
  readonly quarantineMessage: string | null;
  readonly run: () => Promise<void>;
}
const SyncContext = createContext<SyncContextValue>({
  pending: 0,
  running: false,
  label: "Synchronizace se připravuje",
  error: null,
  quarantined: 0,
  quarantineMessage: null,
  run: async () => {},
});

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

export function SyncStatusIndicator() {
  const sync = useSync();
  return (
    <span aria-live="polite" className="max-w-full text-ink-2">
      {sync.label}
      {sync.quarantineMessage ? (
        <span className="ml-2 text-warn">{sync.quarantineMessage}</span>
      ) : null}
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
  const [quarantined, setQuarantined] = useState(0);
  const [quarantineMessage, setQuarantineMessage] = useState<string | null>(null);
  const active = useRef(false);
  const rerun = useRef(false);

  const run = useCallback(async () => {
    if (active.current) {
      if (!navigator.onLine) {
        setState("offline");
        void pendingCount(indexedDB, userId)
          .then(setPending)
          .catch(() => {});
        return;
      }
      rerun.current = true;
      return;
    }
    active.current = true;
    setRunning(true);
    setErrorMessage(null);
    try {
      const previousQuarantine = await quarantineSummary(indexedDB, userId);
      setQuarantined(previousQuarantine.total);
      setQuarantineMessage(formatQuarantineMessage(previousQuarantine));
      const initial = await pendingCount(indexedDB, userId);
      setPending(initial);
      if (!navigator.onLine) {
        setState("offline");
        return;
      }
      const resetGeneration = await runAttemptSync(indexedDB, userId);
      if (resetGeneration) {
        updateAccountMarkerProgressGeneration(userId, resetGeneration);
        window.location.reload();
        return;
      }
      const remaining = await pendingCount(indexedDB, userId);
      const quarantine = await quarantineSummary(indexedDB, userId);
      setPending(remaining);
      setQuarantined(quarantine.total);
      setQuarantineMessage(formatQuarantineMessage(quarantine));
      setState(remaining > 0 ? "pending" : "synced");
    } catch (error) {
      setState(navigator.onLine ? "error" : "offline");
      setPending(await pendingCount(indexedDB, userId).catch(() => 0));
      const quarantine = await quarantineSummary(indexedDB, userId).catch(() => null);
      if (quarantine) {
        setQuarantined(quarantine.total);
        setQuarantineMessage(formatQuarantineMessage(quarantine));
      }
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
    const onOnline = onRun;
    const onOffline = () => {
      setState("offline");
      void pendingCount(indexedDB, userId)
        .then(setPending)
        .catch(() => {});
      void run();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onRun);
    window.addEventListener("inorganic:attempt-saved", onRun);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onRun, 5 * 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onRun);
      window.removeEventListener("inorganic:attempt-saved", onRun);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [run, userId]);

  const label =
    state === "offline"
      ? `Offline · čeká ${pending}`
      : state === "error"
        ? `Chyba synchronizace · čeká ${pending}`
        : quarantined > 0
          ? `V karanténě ${quarantined}`
          : running
            ? "Synchronizuji…"
            : pending > 0
              ? `Čeká ${pending}`
              : "Synchronizováno";
  return (
    <SyncContext.Provider
      value={{
        pending,
        running,
        label,
        error: errorMessage,
        quarantined,
        quarantineMessage,
        run,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

function formatQuarantineMessage(
  summary: Awaited<ReturnType<typeof quarantineSummary>>,
): string | null {
  if (summary.total === 0) return null;
  const reasons = [...new Set(summary.recentReasons)].slice(0, 3).join(" ");
  return `Odděleno ${summary.total} pokusů do lokální karantény. ${reasons}`.trim();
}
