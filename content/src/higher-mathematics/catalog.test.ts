import { describe, expect, it } from "vitest";
import { mathTopic01 } from "./topic-01";
import { mathTopic02 } from "./topic-02";
import { mathTopic03 } from "./topic-03";
import { mathTopic04 } from "./topic-04";
import { mathTopic05 } from "./topic-05";
import { mathTopic06 } from "./topic-06";
import { mathTopic07 } from "./topic-07";
import { mathTopic08 } from "./topic-08";
import { mathTopic09 } from "./topic-09";

const topics = [
  mathTopic01,
  mathTopic02,
  mathTopic03,
  mathTopic04,
  mathTopic05,
  mathTopic06,
  mathTopic07,
  mathTopic08,
  mathTopic09,
];

describe("higher mathematics curriculum", () => {
  it("contains nine unique Czech topics with at least ten distinct questions each", () => {
    expect(topics).toHaveLength(9);
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(9);

    const allIds: string[] = [];
    for (const topic of topics) {
      expect(topic.status).toBe("draft");
      expect(topic.responsibleEditor).toBe("Codex");
      expect(topic.sources.length).toBeGreaterThan(0);
      expect(topic.verificationNote.trim()).not.toBe("");
      expect(topic.exercises.length).toBeGreaterThanOrEqual(10);
      expect(new Set(topic.exercises.map((exercise) => exercise.prompt)).size).toBe(
        topic.exercises.length,
      );
      for (const exercise of topic.exercises) {
        allIds.push(exercise.id);
        expect(exercise.id).toMatch(/^math\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/);
        expect(exercise.prompt.trim()).not.toBe("");
        expect(exercise.answer.trim()).not.toBe("");
        expect(exercise.hints.length).toBeGreaterThan(0);
        expect(exercise.solutionSteps.length).toBeGreaterThanOrEqual(3);
        expect(exercise.hints.every((hint) => hint.trim().length > 0)).toBe(true);
        expect(exercise.solutionSteps.every((step) => step.trim().length > 0)).toBe(true);
      }
    }
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.length).toBeGreaterThanOrEqual(90);
  });
});
