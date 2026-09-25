import type { AttemptEvent } from "./browser-progress-store";

export type PracticeArea = "periodic" | "equations" | "nomenclature";

export interface AreaSummary {
  readonly attempts: number;
  readonly correct: number;
}

function areaOf(mode: AttemptEvent["mode"]): PracticeArea {
  switch (mode) {
    case "element-name":
    case "periodic-table":
      return "periodic";
    case "equation":
      return "equations";
    case "nomenclature":
      return "nomenclature";
  }
}

/** Answers and correct answers per practice area, from the attempts stored on this device. */
export function summarizeAreas(
  attempts: readonly AttemptEvent[],
): Readonly<Record<PracticeArea, AreaSummary>> {
  const totals: Record<PracticeArea, { attempts: number; correct: number }> = {
    periodic: { attempts: 0, correct: 0 },
    equations: { attempts: 0, correct: 0 },
    nomenclature: { attempts: 0, correct: 0 },
  };
  for (const attempt of attempts) {
    const area = totals[areaOf(attempt.mode)];
    area.attempts += 1;
    if (attempt.isCorrect) area.correct += 1;
  }
  return totals;
}
