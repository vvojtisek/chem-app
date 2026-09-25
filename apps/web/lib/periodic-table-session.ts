import type { ElementFlashcardData } from "@inorganic/content/runtime";
import { z } from "zod";

import type { ElementPromptMode } from "./periodic-table-preferences";
import type { PracticeQueueState } from "./practice-queue";

export const PERIODIC_CHECKPOINT_VERSION = 1;
export const PERIODIC_POSITION_SESSION_ID = "periodic-table-position";
export const PERIODIC_NAME_SESSION_ID = "periodic-table-name";

const elementId = z.string().min(1);
const count = z.number().int().nonnegative();

export const periodicCheckpointSchema = z
  .strictObject({
    id: z.enum([PERIODIC_POSITION_SESSION_ID, PERIODIC_NAME_SESSION_ID]),
    checkpointVersion: z.literal(PERIODIC_CHECKPOINT_VERSION),
    revision: count,
    contentVersion: z.string().min(1),
    selectedIds: z.array(elementId).min(1).max(118),
    mode: z.enum(["name-to-position", "name-to-symbol", "symbol-to-name"]),
    currentId: elementId,
    queueIds: z.array(elementId).max(118),
    solvedIds: z.array(elementId).max(118),
    missedIds: z.array(elementId).max(118),
    correct: count,
    incorrect: count,
    total: z.number().int().positive().max(118),
    elapsedMs: count,
  })
  .superRefine((checkpoint, context) => {
    const selected = new Set(checkpoint.selectedIds);
    const unanswered = [checkpoint.currentId, ...checkpoint.queueIds];
    const solved = new Set(checkpoint.solvedIds);
    const covered = new Set([...unanswered, ...solved]);
    const coveredOrMissed = new Set([...covered, ...checkpoint.missedIds]);
    const validMode =
      checkpoint.id === PERIODIC_POSITION_SESSION_ID
        ? checkpoint.mode === "name-to-position"
        : checkpoint.mode !== "name-to-position";
    if (
      !validMode ||
      selected.size !== checkpoint.selectedIds.length ||
      checkpoint.total !== selected.size ||
      unanswered.length !== new Set(unanswered).size ||
      solved.size !== checkpoint.solvedIds.length ||
      unanswered.some((id) => solved.has(id)) ||
      coveredOrMissed.size !== selected.size ||
      [...covered].some((id) => !selected.has(id)) ||
      checkpoint.missedIds.length !== new Set(checkpoint.missedIds).size ||
      checkpoint.missedIds.some((id) => !selected.has(id)) ||
      checkpoint.correct !== solved.size ||
      checkpoint.incorrect < checkpoint.missedIds.length ||
      checkpoint.incorrect > checkpoint.missedIds.length * 2
    ) {
      context.addIssue({ code: "custom", message: "Invalid periodic-table checkpoint." });
    }
  });

export type PeriodicCheckpoint = z.infer<typeof periodicCheckpointSchema>;
export type PeriodicSessionMode = "name-to-position" | ElementPromptMode;

export function createPeriodicCheckpoint(
  id: PeriodicCheckpoint["id"],
  session: PracticeQueueState<ElementFlashcardData>,
  selectedIds: ReadonlySet<string>,
  mode: PeriodicSessionMode,
  contentVersion: string,
  elapsedMs: number,
  revision: number,
): PeriodicCheckpoint | null {
  if (session.status !== "running" || !session.current) return null;
  return periodicCheckpointSchema.parse({
    id,
    checkpointVersion: PERIODIC_CHECKPOINT_VERSION,
    revision,
    contentVersion,
    selectedIds: [...selectedIds],
    mode,
    currentId: session.current.id,
    queueIds: session.queue.map((element) => element.id),
    solvedIds: [...session.solvedIds],
    missedIds: [...session.missedIds],
    correct: session.correct,
    incorrect: session.incorrect,
    total: session.total,
    elapsedMs: Math.round(elapsedMs),
  });
}

/** Rebuilds questions from current reviewed content without storing answer text. */
export function restorePeriodicSession(
  checkpoint: PeriodicCheckpoint,
  elementsById: ReadonlyMap<string, ElementFlashcardData>,
  contentVersion: string,
): PracticeQueueState<ElementFlashcardData> {
  if (checkpoint.contentVersion !== contentVersion) {
    throw new Error("Uložené cvičení používá jinou verzi učiva.");
  }
  const records = [checkpoint.currentId, ...checkpoint.queueIds].map((id) => elementsById.get(id));
  if (
    !records.every((record): record is ElementFlashcardData => record !== undefined) ||
    checkpoint.selectedIds.some((id) => !elementsById.has(id))
  ) {
    throw new Error("Uložené cvičení obsahuje nedostupný prvek.");
  }
  const [current, ...queue] = records;
  if (!current) throw new Error("Uložené cvičení nemá aktuální otázku.");
  return {
    status: "running",
    current,
    queue,
    solvedIds: new Set(checkpoint.solvedIds),
    missedIds: new Set(checkpoint.missedIds),
    correct: checkpoint.correct,
    incorrect: checkpoint.incorrect,
    total: checkpoint.total,
  };
}
