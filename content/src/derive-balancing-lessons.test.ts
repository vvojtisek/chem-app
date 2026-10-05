import { deriveBalancing } from "@inorganic/chemistry";
import { describe, expect, it } from "vitest";
import { curatedBalancingReactionLessons } from "./balancing-reactions-runtime";
import { findBalancingReactionProblems } from "./balancing-reactions-validation";
import { curatedElements } from "./runtime";

const symbols = new Set(curatedElements.map((e) => e.symbol));
describe("pedagogical dataset derivations", () => {
  it("rejects dummy prose and a misleading additional constraint at content validation", () => {
    const lesson = curatedBalancingReactionLessons.find((l) => l.derivationConstraints?.length);
    if (!lesson) throw new Error("Missing peroxide fixture");
    const broken = {
      ...lesson,
      derivationConstraints: [
        { label: "False peroxide ratio", values: [1], explanation: "Invalid constraint" },
      ],
      steps: lesson.steps.map((step, i) =>
        i === 0
          ? {
              ...step,
              explanation:
                "Tím přiblížíme bilanci atomů k výslednému nejmenšímu celočíselnému poměru.",
            }
          : step,
      ),
    };
    expect(findBalancingReactionProblems([broken], symbols)).toContainEqual({
      code: "placeholder_derivation",
      recordId: lesson.id,
    });
    expect(findBalancingReactionProblems([broken], symbols)).toContainEqual({
      code: "invalid_derivation_constraint",
      recordId: lesson.id,
    });
  });
  it("independently derives the source ratio of all 114 lessons from formulas and explicit constraints", () => {
    for (const lesson of curatedBalancingReactionLessons) {
      const final = lesson.steps.at(-1);
      if (!final) throw new Error(lesson.id);
      const result = deriveBalancing(
        final.equation.reactants,
        final.equation.products,
        symbols,
        lesson.derivationConstraints,
      );
      expect(result.ok, lesson.id).toBe(true);
      if (!result.ok) continue;
      expect(result.coefficients, lesson.id).toEqual(
        [...final.equation.reactants, ...final.equation.products].map((s) => s.coefficient),
      );
      for (const step of lesson.steps) {
        expect(step.explanation, lesson.id).not.toMatch(
          /Tím přiblížíme|Před .* doplníme koeficient .*nejmenšímu/u,
        );
        expect(step.explanation, `${lesson.id}/${step.stepIndex}`).toMatch(/\d/u);
      }
    }
  });
  it("resolves the two fluorine coefficients together and writes water last", () => {
    const lesson = curatedBalancingReactionLessons.find(
      (l) => l.id === "reaction.balancing.cat-1-02",
    );
    expect(lesson?.steps).toHaveLength(5);
    expect(lesson?.steps[1]?.coefficientChanges).toEqual(["BF3", "H[BF4]"]);
    expect(lesson?.steps[1]?.explanation).toContain("NSN(3, 4) = 12");
    expect(lesson?.steps[2]?.explanation).toContain("4 − 3 = 1");
    expect(lesson?.steps[2]?.equation.reactants[1]?.coefficient).toBe(1);
    expect(lesson?.steps[3]?.equation.reactants[1]?.coefficient).toBe(3);
  });
  it("names all six additional peroxide constraints without presenting them as atom-balance deductions", () => {
    const lessons = curatedBalancingReactionLessons.filter((l) => l.derivationConstraints?.length);
    expect(lessons).toHaveLength(6);
    for (const lesson of lessons) {
      expect(lesson.derivationConstraints?.[0]?.explanation).toContain(
        "Samotné atomy a náboj neurčují",
      );
      expect(lesson.sources.some((s) => s.locator.includes("openstax.org"))).toBe(true);
      expect(lesson.steps.some((s) => s.explanation.includes("0 = +2 −2"))).toBe(true);
    }
  });
  it("writes water only after the first complete derivation of its companion coefficients", () => {
    for (const lesson of curatedBalancingReactionLessons) {
      const firstComplete = lesson.steps.findIndex(
        (s) =>
          s.balanceLedger?.atoms?.every((a) => a.reactants === a.products) &&
          (!s.balanceLedger.charge ||
            s.balanceLedger.charge.reactants === s.balanceLedger.charge.products),
      );
      const changes = lesson.steps
        .slice(0, firstComplete + 1)
        .flatMap((s) => s.coefficientChanges ?? []);
      if (changes.includes("H2O")) expect(changes.at(-1), lesson.id).toBe("H2O");
      if (lesson.steps[0]?.balanceLedger?.charge)
        expect(
          lesson.steps
            .slice(0, -1)
            .some((s) => /náboj|Náboj/u.test(s.explanation) && /=/u.test(s.explanation)),
          lesson.id,
        ).toBe(true);
    }
  });
});
