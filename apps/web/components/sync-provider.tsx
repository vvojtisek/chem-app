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
import { AlertIcon, ClockIcon, CloudCheckIcon, CloudOffIcon } from "./icons";

type SyncState = "synced" | "pending" | "offline" | "error";
/** What the status chip shows, derived from the sync state and the local queues. */
export type SyncStatus =
  | "preparing"
  | "synced"
  | "running"
  | "pending"
  | "offline"
  | "error"
  | "quarantine";
interface SyncContextValue {
  readonly status: SyncStatus;
  readonly pending: number;
  readonly running: boolean;
  readonly label: string;
  readonly error: string | null;
  readonly quarantined: number;
  readonly quarantineMessage: string | null;
  readonly run: () => Promise<void>;
}
const SyncContext = createContext<SyncContextValue>({
  status: "preparing",
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

const CHIP_STYLE: Readonly<Record<SyncStatus, string>> = {
  preparing: "border-line bg-surface-2 text-ink-2",
  synced: "border-good/40 bg-good-soft text-good",
  running: "border-line bg-surface-2 text-ink-2",
  pending: "border-warn/40 bg-warn-soft text-warn",
  offline: "border-line bg-surface-2 text-ink-2",
  error: "border-bad/40 bg-bad-soft text-bad",
  quarantine: "border-warn/40 bg-warn-soft text-warn",
};

function ChipIcon({ status }: Readonly<{ status: SyncStatus }>) {
  switch (status) {
    case "synced":
      return <CloudCheckIcon />;
    case "offline":
      return <CloudOffIcon />;
    case "error":
    case "quarantine":
      return <AlertIcon />;
    case "preparing":
    case "running":
    case "pending":
      return <ClockIcon />;
  }
}

/** Sync state as an icon plus words, so it never depends on colour alone. */
export function SyncStatusChip() {
  const sync = useSync();
  return (
    <span
      aria-live="polite"
      className={`inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${CHIP_STYLE[sync.status]}`}
      title={sync.quarantineMessage ?? undefined}
    >
      <ChipIcon status={sync.status} />
      <span className="truncate">{sync.label}</span>
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

  const status: SyncStatus =
    state === "offline"
      ? "offline"
      : state === "error"
        ? "error"
        : quarantined > 0
          ? "quarantine"
          : running
            ? "running"
            : pending > 0
              ? "pending"
              : "synced";
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
        status,
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
