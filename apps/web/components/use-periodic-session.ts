"use client";

import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  type BrowserPeriodicSessionStore,
  createBrowserPeriodicSessionStore,
} from "@/lib/browser-periodic-session-store";
import {
  createPeriodicCheckpoint,
  type PeriodicCheckpoint,
  type PeriodicSessionMode,
} from "@/lib/periodic-table-session";
import type { PracticeQueueState } from "@/lib/practice-queue";

interface PeriodicSessionPersistence {
  readonly loading: boolean;
  readonly storageBroken: boolean;
  readonly notice: string;
  readonly save: (
    session: PracticeQueueState<ElementFlashcardData>,
    selection: ReadonlySet<string>,
    mode: PeriodicSessionMode,
    elapsedMs: number,
  ) => void;
  readonly discard: () => void;
  readonly recover: () => Promise<void>;
}

export function usePeriodicSession(
  id: PeriodicCheckpoint["id"],
  contentVersion: string,
  onRestore: (checkpoint: PeriodicCheckpoint) => void,
): PeriodicSessionPersistence {
  const [loading, setLoading] = useState(true);
  const [storageBroken, setStorageBroken] = useState(false);
  const [notice, setNotice] = useState("");
  const storeRef = useRef<BrowserPeriodicSessionStore | null>(null);
  const persistedRevisionRef = useRef(0);
  const queuedWritesRef = useRef<Promise<void>>(Promise.resolve());
  const localOnlyRef = useRef(false);
  const restore = useEffectEvent(onRestore);

  function store(): BrowserPeriodicSessionStore {
    storeRef.current ??= createBrowserPeriodicSessionStore();
    return storeRef.current;
  }

  useEffect(() => {
    let mounted = true;
    const browserStore = createBrowserPeriodicSessionStore();
    storeRef.current = browserStore;
    browserStore
      .load(id)
      .then((saved) => {
        if (!mounted || !saved) return;
        try {
          if (saved.contentVersion !== contentVersion) {
            throw new Error("Uložené cvičení používá jinou verzi učiva.");
          }
          restore(saved);
          persistedRevisionRef.current = saved.revision;
        } catch {
          localOnlyRef.current = true;
          setStorageBroken(true);
          setNotice(
            "Uložené cvičení nelze bezpečně obnovit. Odstraňte pouze tuto sérii; historie pokusů zůstane zachována.",
          );
        }
      })
      .catch(() => {
        if (!mounted) return;
        localOnlyRef.current = true;
        setStorageBroken(true);
        setNotice(
          "Uložené cvičení nelze načíst. Odstraňte pouze tuto sérii; historie pokusů zůstane zachována.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, contentVersion]);

  function queueWrite(
    session: PracticeQueueState<ElementFlashcardData> | null,
    selection?: ReadonlySet<string>,
    mode?: PeriodicSessionMode,
    elapsedMs?: number,
  ): void {
    if (localOnlyRef.current) return;
    queuedWritesRef.current = queuedWritesRef.current
      .then(async () => {
        if (localOnlyRef.current) return;
        const revision = persistedRevisionRef.current;
        const checkpoint =
          session && selection && mode && elapsedMs !== undefined
            ? createPeriodicCheckpoint(
                id,
                session,
                selection,
                mode,
                contentVersion,
                elapsedMs,
                revision + 1,
              )
            : null;
        await store().write(id, checkpoint, revision);
        persistedRevisionRef.current = checkpoint ? checkpoint.revision : 0;
      })
      .catch(() => {
        localOnlyRef.current = true;
        setStorageBroken(true);
        setNotice(
          "Průběh cvičení se nepodařilo uložit. Obnovte úložiště před dalším načtením stránky.",
        );
      });
  }

  async function recover(): Promise<void> {
    await queuedWritesRef.current;
    try {
      await store().clear(id);
      persistedRevisionRef.current = 0;
      localOnlyRef.current = false;
      setStorageBroken(false);
      setNotice("Uložená série byla odstraněna. Historie pokusů zůstala zachována.");
    } catch {
      setNotice("Lokální úložiště stále není dostupné. Zkuste to znovu po obnovení stránky.");
    }
  }

  return {
    loading,
    storageBroken,
    notice,
    save: (session, selection, mode, elapsedMs) => queueWrite(session, selection, mode, elapsedMs),
    discard: () => queueWrite(null),
    recover,
  };
}
