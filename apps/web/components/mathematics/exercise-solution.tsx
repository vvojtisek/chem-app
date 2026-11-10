"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { MathExercise } from "@inorganic/content/higher-mathematics";
import { useCapabilities } from "@/components/auth-gate";
import { SolutionView } from "@/components/subject-workspace";
import workspace from "@/components/subject-workspace.module.css";
import { ApiError, listSubjects, solveSubjectProblem } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { MathText } from "./math-text";
import styles from "./practice.module.css";
import { MATH_SUBJECT_ID } from "./routes";

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Authored steps as numbered step cards, revealed one by one. */
function AuthoredSteps({ exercise }: Readonly<{ exercise: MathExercise }>) {
  const [shown, setShown] = useState(1);
  const total = exercise.solutionSteps.length;
  return (
    <div className="grid gap-2">
      <ol aria-label="Kroky řešení" className={workspace.steps}>
        {exercise.solutionSteps.slice(0, shown).map((step, index) => (
          <li className={styles.stepRow} key={`${exercise.id}-step-${step}`}>
            <span className={workspace.stepNumber}>{index + 1}</span>
            <span className={styles.stepText}>
              <MathText display>{step}</MathText>
            </span>
          </li>
        ))}
      </ol>
      {shown < total ? (
        <div className={workspace.actions}>
          <button
            className={workspace.primaryButton}
            onClick={() => setShown((count) => count + 1)}
            type="button"
          >
            Další krok ({shown + 1}/{total})
          </button>
          <button
            className={workspace.secondaryButton}
            onClick={() => setShown(total)}
            type="button"
          >
            Celé řešení
          </button>
        </div>
      ) : (
        <p className={workspace.answer}>
          Výsledek: <MathText display>{exercise.answerLabel ?? exercise.answer}</MathText>
        </p>
      )}
    </div>
  );
}

/**
 * Solution of one exercise. With a solver link, a signed-in learner online
 * sees the server's verified SymPy steps, graph and animation (as in Učivo);
 * the authored steps always follow and are the offline and guest fallback.
 */
export function ExerciseSolution({ exercise }: Readonly<{ exercise: MathExercise }>) {
  const online = useOnline();
  const { isGuest } = useCapabilities();
  const problem = exercise.solver;
  const canSolve = Boolean(problem) && online && !isGuest;
  const subjects = useQuery({
    queryKey: queryKeys.subjects.list,
    queryFn: listSubjects,
    enabled: canSolve,
    staleTime: 5 * 60_000,
  });
  const request = problem
    ? { problemType: problem.problemType, values: { ...problem.values } }
    : null;
  const solution = useQuery({
    queryKey: queryKeys.subjects.practiceSolution(MATH_SUBJECT_ID, exercise.id),
    queryFn: () => solveSubjectProblem(MATH_SUBJECT_ID, request as NonNullable<typeof request>),
    enabled: canSolve && request !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const subject = subjects.data?.find((item) => item.id === MATH_SUBJECT_ID);

  return (
    <section aria-labelledby="math-solution-title" className="grid gap-3">
      <h3 className={styles.sectionHeading} id="math-solution-title">
        Řešení krok za krokem
      </h3>
      {problem ? (
        <section aria-labelledby="math-sympy-title" className="grid gap-2">
          <h4 className={workspace.cardTitle} id="math-sympy-title">
            Výpočet ověřený SymPy
          </h4>
          {!online ? (
            <p className={workspace.hint}>Výpočet se zobrazí po připojení k internetu.</p>
          ) : isGuest ? (
            <p className={workspace.hint}>
              Výpočet s grafem a animací vidí přihlášení uživatelé. Níže je psaný postup.
            </p>
          ) : solution.isPending || subjects.isPending ? (
            <p className={workspace.hint} role="status">
              Počítám řešení…
            </p>
          ) : solution.isError || !subject || !request ? (
            <p className={workspace.hint}>
              {solution.error instanceof ApiError && solution.error.status === 429
                ? "Limit výpočtů na serveru je na chvíli vyčerpán, zkuste to za několik minut."
                : "Výpočet se nepodařilo načíst."}{" "}
              Níže je psaný postup.
            </p>
          ) : (
            <SolutionView reveal request={request} solution={solution.data} subject={subject} />
          )}
        </section>
      ) : null}
      <div className="grid gap-2">
        {problem ? <h4 className={workspace.cardTitle}>Postup k odpovědi</h4> : null}
        <AuthoredSteps exercise={exercise} key={exercise.id} />
      </div>
    </section>
  );
}
