"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long a wrongly answered cell shows its red ✗ before it returns to „?“. */
export const WRONG_MARK_DURATION_MS = 10_000;

export interface WrongMarks {
  readonly marked: ReadonlySet<string>;
  /** Reads the marks synchronously, so repeated events in one tick see the latest state. */
  readonly isMarked: (elementId: string) => boolean;
  readonly mark: (elementId: string) => void;
  readonly unmark: (elementId: string) => void;
  readonly clear: () => void;
}

export function useWrongMarks(): WrongMarks {
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());
  const markedRef = useRef<ReadonlySet<string>>(new Set());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clear = useCallback(() => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
    markedRef.current = new Set();
    setMarked(new Set());
  }, []);

  useEffect(() => clear, [clear]);

  function setMark(elementId: string, isMarked: boolean) {
    const timers = timersRef.current;
    clearTimeout(timers.get(elementId));
    timers.delete(elementId);

    const next = new Set(markedRef.current);
    if (isMarked) {
      next.add(elementId);
      timers.set(
        elementId,
        setTimeout(() => setMark(elementId, false), WRONG_MARK_DURATION_MS),
      );
    } else {
      next.delete(elementId);
    }
    markedRef.current = next;
    setMarked(next);
  }

  return {
    marked,
    isMarked: (elementId) => markedRef.current.has(elementId),
    mark: (elementId) => setMark(elementId, true),
    unmark: (elementId) => setMark(elementId, false),
    clear,
  };
}
