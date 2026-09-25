"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long a wrongly answered cell shows its red ✗ before it returns to „?“. */
export const WRONG_MARK_DURATION_MS = 10_000;
const COUNTDOWN_TICK_MS = 250;

export interface WrongMarks {
  readonly marked: ReadonlySet<string>;
  /** Reads the marks synchronously, so repeated events in one tick see the latest state. */
  readonly isMarked: (elementId: string) => boolean;
  /** Whole seconds until the mark clears, for the countdown shown next to the ✗. */
  readonly secondsLeft: (elementId: string) => number | null;
  readonly mark: (elementId: string) => void;
  readonly unmark: (elementId: string) => void;
  readonly clear: () => void;
}

export function useWrongMarks(): WrongMarks {
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());
  const [now, setNow] = useState(0);
  const markedRef = useRef<ReadonlySet<string>>(new Set());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const expiriesRef = useRef(new Map<string, number>());

  const clear = useCallback(() => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
    expiriesRef.current.clear();
    markedRef.current = new Set();
    setMarked(new Set());
  }, []);

  useEffect(() => clear, [clear]);

  const hasMarks = marked.size > 0;
  useEffect(() => {
    if (!hasMarks) return;
    const interval = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [hasMarks]);

  function setMark(elementId: string, isMarked: boolean) {
    const timers = timersRef.current;
    clearTimeout(timers.get(elementId));
    timers.delete(elementId);

    const next = new Set(markedRef.current);
    if (isMarked) {
      next.add(elementId);
      const markedAt = Date.now();
      expiriesRef.current.set(elementId, markedAt + WRONG_MARK_DURATION_MS);
      setNow(markedAt);
      timers.set(
        elementId,
        setTimeout(() => setMark(elementId, false), WRONG_MARK_DURATION_MS),
      );
    } else {
      next.delete(elementId);
      expiriesRef.current.delete(elementId);
    }
    markedRef.current = next;
    setMarked(next);
  }

  return {
    marked,
    isMarked: (elementId) => markedRef.current.has(elementId),
    secondsLeft: (elementId) => {
      const expiresAt = expiriesRef.current.get(elementId);
      return expiresAt === undefined ? null : Math.max(1, Math.ceil((expiresAt - now) / 1000));
    },
    mark: (elementId) => setMark(elementId, true),
    unmark: (elementId) => setMark(elementId, false),
    clear,
  };
}
