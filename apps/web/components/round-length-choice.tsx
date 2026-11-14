"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { SegmentedChoice } from "@/components/segmented-choice";
import {
  DEFAULT_ROUND_LENGTH,
  loadRoundLength,
  ROUND_LENGTHS,
  type RoundLength,
  saveRoundLength,
} from "@/lib/round-length";

/**
 * The remembered round length of one exercise. The prerendered page starts with `fallback`;
 * the stored choice is applied after mount. `persist` is false for read-only accounts.
 */
export function useRoundLength(
  exercise: string,
  persist: boolean,
  fallback: RoundLength = DEFAULT_ROUND_LENGTH,
): readonly [RoundLength, (length: RoundLength) => void] {
  const [length, setLength] = useState<RoundLength>(fallback);
  useEffect(() => {
    if (persist) setLength(loadRoundLength(exercise, fallback));
  }, [exercise, persist, fallback]);
  const change = useCallback(
    (next: RoundLength) => {
      setLength(next);
      if (persist) saveRoundLength(exercise, next);
    },
    [exercise, persist],
  );
  return [length, change];
}

/** 10, 20 or every selected item; the label of „Vše“ shows how many that is. */
export function RoundLengthChoice({
  value,
  available,
  onChange,
}: Readonly<{ value: RoundLength; available: number; onChange: (value: RoundLength) => void }>) {
  const name = useId();
  return (
    <SegmentedChoice
      legend="Délka kola"
      name={name}
      onSelect={onChange}
      options={ROUND_LENGTHS.map((length) => ({
        value: length,
        label: length === null ? `Vše (${available})` : String(length),
      }))}
      value={value}
    />
  );
}
