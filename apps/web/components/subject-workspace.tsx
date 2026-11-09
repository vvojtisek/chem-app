"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useCapabilities } from "@/components/auth-gate";
import { MathTex } from "@/components/math-tex";
import { ScenePlot } from "@/components/scene-plot";
import {
  ApiError,
  explainSubjectSolution,
  getSubjectRender,
  listSubjects,
  previewSubjectInput,
  requestSubjectRender,
  type Subject,
  type SubjectExplanation,
  type SubjectInputField,
  type SubjectPreview,
  type SubjectProblemType,
  type SubjectSolution,
  type SubjectStep,
  solveSubjectProblem,
} from "@/lib/api/client";
import { cn } from "@/lib/class-names";
import { queryKeys } from "@/lib/query-keys";
import styles from "./subject-workspace.module.css";

type Values = Record<string, string>;
type RenderFormat = "mp4" | "gif";

const PREVIEW_DELAY_MS = 400;
const RENDER_POLL_MS = 2500;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Požadavek se nepodařilo dokončit.";
}

export function initialValues(problemType: SubjectProblemType): Values {
  const values: Values = {};
  for (const field of problemType.fields) {
    values[field.name] = problemType.example[field.name] ?? field.default ?? "";
  }
  return values;
}

/** Drop empty optional fields so the server applies its own defaults. */
export function requestValues(problemType: SubjectProblemType, values: Values): Values {
  const result: Values = {};
  for (const field of problemType.fields) {
    const value = values[field.name]?.trim() ?? "";
    if (value) result[field.name] = value;
  }
  return result;
}

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

function FieldInput({
  field,
  value,
  preview,
  onChange,
}: Readonly<{
  field: SubjectInputField;
  value: string;
  preview: SubjectPreview["fields"][string] | undefined;
  onChange: (value: string) => void;
}>) {
  const id = `subject-field-${field.name}`;
  const wide = field.kind === "expression" || field.kind === "equation";
  if (field.kind === "variable" || field.kind === "choice") {
    return (
      <label className={styles.field} htmlFor={id}>
        <span className={styles.label}>{field.label}</span>
        <select
          className={styles.input}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const errorId = `${id}-error`;
  return (
    <div className={cn(styles.field, wide && styles.fieldWide)}>
      <label className={styles.label} htmlFor={id}>
        {field.label}
        {field.required ? null : " (nepovinné)"}
      </label>
      <input
        aria-describedby={preview?.error ? errorId : undefined}
        aria-invalid={preview?.error ? true : undefined}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={styles.input}
        id={id}
        inputMode="text"
        maxLength={200}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        spellCheck={false}
        value={value}
      />
      {preview?.latex ? (
        <div aria-hidden="true" className={styles.preview}>
          <MathTex latex={preview.latex} />
        </div>
      ) : null}
      {preview?.error ? (
        <p className={styles.fieldError} id={errorId}>
          {preview.error}
        </p>
      ) : null}
    </div>
  );
}

function flattenIndices(steps: readonly SubjectStep[]): Map<SubjectStep, number> {
  const indices = new Map<SubjectStep, number>();
  const visit = (items: readonly SubjectStep[]) => {
    for (const step of items) {
      indices.set(step, indices.size);
      visit(step.substeps);
    }
  };
  visit(steps);
  return indices;
}

function StepItem({
  step,
  number,
  narratives,
  indices,
}: Readonly<{
  step: SubjectStep;
  number: string;
  narratives: ReadonlyMap<number, string>;
  indices: ReadonlyMap<SubjectStep, number>;
}>) {
  const narrative = narratives.get(indices.get(step) ?? -1);
  return (
    <li>
      <details className={styles.step} open={number.split(".").length === 1 ? undefined : false}>
        <summary className={styles.stepSummary}>
          <span className={styles.stepNumber}>{number}</span>
          <span>{step.title}</span>
        </summary>
        <div className={styles.stepBody}>
          {step.before ? <MathTex display latex={step.before} /> : null}
          {step.rewritten && step.rewritten !== step.after ? (
            <MathTex display latex={`= ${step.rewritten}`} />
          ) : null}
          <MathTex display latex={step.before ? `= ${step.after}` : step.after} />
          <p className={styles.hint}>{step.justification}</p>
          {narrative ? (
            <p className={styles.narrative}>
              <span className={styles.generatedLabel}>AI</span> {narrative}
            </p>
          ) : null}
          {step.substeps.length > 0 ? (
            <ol aria-label="Dílčí kroky" className={styles.substeps}>
              {step.substeps.map((child, index) => (
                <StepItem
                  indices={indices}
                  // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered, immutable list.
                  key={`${number}.${index + 1}`}
                  narratives={narratives}
                  number={`${number}.${index + 1}`}
                  step={child}
                />
              ))}
            </ol>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function RenderCard({
  subject,
  problemType,
  values,
}: Readonly<{ subject: Subject; problemType: string; values: Values }>) {
  const [format, setFormat] = useState<RenderFormat>("mp4");
  const [key, setKey] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: () => requestSubjectRender(subject.id, { problemType, values, format }),
    onSuccess: (status) => setKey(status.key),
  });
  const status = useQuery({
    queryKey: queryKeys.subjects.render(subject.id, key ?? "none"),
    queryFn: () => getSubjectRender(subject.id, key as string),
    enabled: key !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "done" || query.state.data?.status === "failed"
        ? false
        : RENDER_POLL_MS,
  });
  const current = status.data ?? request.data;

  if (!subject.renderingEnabled) {
    return (
      <p className={styles.hint}>
        Animace nejsou na tomto serveru zapnuté. Graf výše je k dispozici vždy.
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <div className={styles.actions}>
        <label className={styles.hint} htmlFor="render-format">
          Formát
        </label>
        <select
          className={styles.input}
          id="render-format"
          onChange={(event) => setFormat(event.target.value as RenderFormat)}
          value={format}
        >
          <option value="mp4">MP4</option>
          <option value="gif">GIF</option>
        </select>
        <button
          className={styles.secondaryButton}
          disabled={request.isPending}
          onClick={() => request.mutate()}
          type="button"
        >
          Vytvořit animaci
        </button>
      </div>
      <p aria-live="polite" className={styles.hint}>
        {request.isError ? errorMessage(request.error) : null}
        {current?.status === "queued" ? "Animace čeká ve frontě…" : null}
        {current?.status === "rendering" ? "Animace se vykresluje, obvykle do minuty…" : null}
        {current?.status === "failed" ? "Animaci se nepodařilo vykreslit." : null}
      </p>
      {current?.status === "done" && current.videoUrl ? (
        format === "gif" || current.videoUrl.endsWith(".gif") ? (
          // biome-ignore lint/performance/noImgElement: authenticated API media, not a static asset.
          <img alt="Animace řešení" className={styles.video} src={current.videoUrl} />
        ) : (
          // biome-ignore lint/a11y/useMediaCaption: the steps beside the video are the text equivalent.
          <video className={styles.video} controls preload="metadata" src={current.videoUrl} />
        )
      ) : null}
      {current?.status === "done" && current.videoUrl ? (
        <a className={styles.secondaryButton} download href={current.videoUrl}>
          Stáhnout {format.toUpperCase()}
        </a>
      ) : null}
    </div>
  );
}

function ExplanationCard({
  explanation,
}: Readonly<{ explanation: SubjectExplanation | undefined }>) {
  if (!explanation) return null;
  return (
    <section aria-label="Vysvětlení" className={styles.card}>
      <h3 className={styles.cardTitle}>
        Vysvětlení <span className={styles.generatedLabel}>vygenerováno AI</span>
      </h3>
      <p>{explanation.summary}</p>
      {explanation.alternativeMethods.length > 0 ? (
        <>
          <h4 className={styles.label}>Jiné postupy</h4>
          <ul className="ml-4 list-disc">
            {explanation.alternativeMethods.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      {explanation.commonMistakes.length > 0 ? (
        <>
          <h4 className={styles.label}>Častá chyba</h4>
          <ul className="ml-4 list-disc">
            {explanation.commonMistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p className={styles.meta}>
        Text napsal jazykový model z ověřených kroků; výsledek spočítal SymPy.
      </p>
    </section>
  );
}

function SolutionView({
  subject,
  solution,
  request,
}: Readonly<{
  subject: Subject;
  solution: SubjectSolution;
  request: { problemType: string; values: Values };
}>) {
  const explain = useMutation({
    mutationFn: () => explainSubjectSolution(subject.id, request),
  });
  const indices = useMemo(() => flattenIndices(solution.steps), [solution.steps]);
  const narratives = useMemo(
    () =>
      new Map((explain.data?.stepNarratives ?? []).map((item) => [item.stepIndex, item.narrative])),
    [explain.data],
  );
  return (
    <div className={styles.result}>
      <section aria-labelledby="solution-heading" className="grid min-w-0 gap-3">
        <div className={styles.equation}>
          <h2 className="sr-only" id="solution-heading">
            Řešení
          </h2>
          <MathTex display latex={solution.problemLatex} />
          <p className={styles.answer}>
            <span className="sr-only">Výsledek: </span>
            <MathTex display latex={`= ${solution.resultLatex}`} />
          </p>
          <p className={styles.meta}>Ověřeno: {solution.verifiedBy}</p>
          {solution.notes.map((note) => (
            <p className={styles.hint} key={note}>
              {note}
            </p>
          ))}
        </div>
        <ol aria-label="Kroky řešení" className={styles.steps}>
          {solution.steps.map((step, index) => (
            <StepItem
              indices={indices}
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered, immutable list.
              key={index}
              narratives={narratives}
              number={`${index + 1}`}
              step={step}
            />
          ))}
        </ol>
      </section>
      <aside className={styles.side}>
        {solution.scene ? (
          <section aria-label="Graf" className={styles.card}>
            <h3 className={styles.cardTitle}>{solution.scene.title}</h3>
            <ScenePlot scene={solution.scene} />
          </section>
        ) : null}
        <section aria-label="Animace" className={styles.card}>
          <h3 className={styles.cardTitle}>Animace</h3>
          <RenderCard problemType={request.problemType} subject={subject} values={request.values} />
        </section>
        {subject.explanationsEnabled ? (
          <section aria-label="Vysvětlit postup" className={styles.card}>
            <button
              className={styles.secondaryButton}
              disabled={explain.isPending}
              onClick={() => explain.mutate()}
              type="button"
            >
              {explain.isPending ? "Připravuji vysvětlení…" : "Vysvětlit postup (AI)"}
            </button>
            {explain.isError ? (
              <p className={styles.alert} role="alert">
                {errorMessage(explain.error)}
              </p>
            ) : null}
          </section>
        ) : null}
        <ExplanationCard explanation={explain.data} />
      </aside>
    </div>
  );
}

export function SubjectWorkspace({ subjectId }: Readonly<{ subjectId: string }>) {
  const online = useOnline();
  const { isGuest } = useCapabilities();
  const subjects = useQuery({
    queryKey: queryKeys.subjects.list,
    queryFn: listSubjects,
    enabled: online && !isGuest,
    staleTime: 5 * 60_000,
  });
  const subject = subjects.data?.find((item) => item.id === subjectId);
  const [typeId, setTypeId] = useState<string | null>(null);
  const problemType =
    subject?.problemTypes.find((item) => item.id === typeId) ?? subject?.problemTypes[0];
  const [values, setValues] = useState<Values>({});
  const [preview, setPreview] = useState<SubjectPreview["fields"]>({});
  const [solved, setSolved] = useState<{
    solution: SubjectSolution;
    request: { problemType: string; values: Values };
  } | null>(null);

  useEffect(() => {
    if (problemType) {
      setValues(initialValues(problemType));
      setPreview({});
    }
  }, [problemType]);

  useEffect(() => {
    if (!subject || !problemType || !online) return;
    const body = { problemType: problemType.id, values: requestValues(problemType, values) };
    const timer = window.setTimeout(() => {
      previewSubjectInput(subject.id, body)
        .then((result) => setPreview(result.fields))
        .catch(() => setPreview({}));
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [subject, problemType, values, online]);

  // Each submit and each problem-type switch starts a new generation; a
  // response from an older generation is dropped, so a slow solve cannot
  // replace the form the learner has moved on to.
  const generation = useRef(0);
  const solve = useMutation({
    mutationFn: ({
      request,
    }: {
      request: { problemType: string; values: Values };
      generation: number;
    }) => solveSubjectProblem(subjectId, request),
    onSuccess: (solution, variables) => {
      if (variables.generation === generation.current) {
        setSolved({ solution, request: variables.request });
      }
    },
  });

  if (!online) {
    return (
      <div className={styles.workspace}>
        <p className={styles.alert} role="status">
          Tento předmět potřebuje připojení k internetu: úlohy řeší server. Ostatní učivo funguje i
          offline.
        </p>
      </div>
    );
  }
  if (isGuest) {
    return (
      <div className={styles.workspace}>
        <p className={styles.alert} role="status">
          Řešení úloh je dostupné jen přihlášeným uživatelům.
        </p>
      </div>
    );
  }
  if (subjects.isPending) {
    return (
      <div className={styles.workspace}>
        <p className={styles.hint} role="status">
          Načítám…
        </p>
      </div>
    );
  }
  if (subjects.isError || !subject || !problemType) {
    return (
      <div className={styles.workspace}>
        <p className={styles.alert} role="alert">
          {subjects.isError ? errorMessage(subjects.error) : "Předmět neexistuje."}
        </p>
      </div>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!problemType) return;
    generation.current += 1;
    solve.mutate({
      request: { problemType: problemType.id, values: requestValues(problemType, values) },
      generation: generation.current,
    });
  }

  return (
    <div className={styles.workspace}>
      <nav aria-label="Typ úlohy">
        <div className={styles.typeList}>
          {subject.problemTypes.map((item) => (
            <button
              aria-pressed={item.id === problemType.id}
              className={cn(
                styles.typeButton,
                item.id === problemType.id && styles.typeButtonActive,
              )}
              key={item.id}
              onClick={() => {
                generation.current += 1;
                setTypeId(item.id);
                setSolved(null);
                solve.reset();
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <p className={styles.hint}>{subject.description}</p>
      <p className={styles.hint}>{problemType.description}</p>
      <form className={styles.form} noValidate onSubmit={submit}>
        {problemType.fields.map((field) => (
          <FieldInput
            field={field}
            key={`${problemType.id}-${field.name}`}
            onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            preview={preview[field.name]}
            value={values[field.name] ?? ""}
          />
        ))}
        <div className={cn(styles.actions, styles.fieldWide)}>
          <button className={styles.primaryButton} disabled={solve.isPending} type="submit">
            {solve.isPending ? "Počítám…" : "Vyřešit"}
          </button>
          <span className={styles.hint}>
            Zápis: 2x^2, sin(x), e^x, ln(x), sqrt(x), pi, oo (nekonečno).
          </span>
        </div>
      </form>
      <div aria-live="polite">
        {solve.isError ? (
          <p className={styles.alert} role="alert">
            {errorMessage(solve.error)}
          </p>
        ) : null}
      </div>
      {solved ? (
        <SolutionView request={solved.request} solution={solved.solution} subject={subject} />
      ) : null}
    </div>
  );
}
