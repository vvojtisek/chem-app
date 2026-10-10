"use client";

import type {
  PreparationProductionProduct,
  PreparationProductionRoute,
} from "@inorganic/content/preparation-production-schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { useAccount } from "@/components/auth-gate";
import { ProductEditor, RouteEditor } from "@/components/curriculum-editor";
import { Equation, Formula } from "@/components/formula";
import {
  ApiError,
  getPreparationProductionCurriculum,
  savePreparationProductionProduct,
} from "@/lib/api/client";
import {
  applyReviewAction,
  availableActions,
  countReviewStates,
  type ReviewAction,
  type ReviewEvidence,
  type ReviewState,
  type ProductInput,
  type ReviewTarget,
  reviewState,
  routeReviewState,
  toFileProduct,
  toProductInput,
} from "@/lib/curriculum-review";
import { queryKeys } from "@/lib/query-keys";

type Filter = ReviewState | "all";

const FILTERS: readonly { readonly value: Filter; readonly label: string }[] = [
  { value: "pending", label: "Čeká na ověření" },
  { value: "validated", label: "Ověřeno" },
  { value: "removed", label: "Odebráno" },
  { value: "all", label: "Vše" },
];

const STATE_LABELS: Record<ReviewState, string> = {
  validated: "Ověřeno",
  pending: "Čeká",
  removed: "Odebráno",
};

const STATE_CLASSES: Record<ReviewState, string> = {
  validated: "border-good bg-good-soft text-good",
  pending: "border-warn bg-warn-soft text-warn",
  removed: "border-line-strong bg-surface-2 text-ink-2",
};

const PILL =
  "inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-4 text-sm font-semibold";
const PILL_ON = "border-good bg-good-soft text-good";
const PILL_OFF = "border-line-strong bg-surface text-ink-2";
const BUTTON = "min-h-11 rounded-xl border px-3 font-medium disabled:opacity-50";

type Editing =
  | { readonly kind: "product"; readonly productId: string | null }
  | { readonly kind: "route"; readonly productId: string; readonly routeId: string | null };

interface OpenForm {
  readonly productId: string;
  readonly target: ReviewTarget;
  readonly kind: "validate" | "remove";
}

function editingKey(editing: Editing): string {
  return editing.kind === "product"
    ? `product:${editing.productId ?? ""}`
    : `route:${editing.productId}:${editing.routeId ?? ""}`;
}

function targetKey(productId: string, target: ReviewTarget): string {
  return target.kind === "product" ? productId : target.routeId;
}

export function curriculumLoadError(cause: unknown): string {
  if (cause instanceof ApiError && cause.code === "curriculum_editing_disabled")
    return "Úpravy dat z aplikace jsou na serveru vypnuté. Zapnou se nastavením CURRICULUM_GITHUB_REPOSITORY a CURRICULUM_GITHUB_TOKEN (viz docs/deployment.md).";
  if (cause instanceof ApiError && cause.code === "curriculum_repository_unavailable")
    return "Repozitář s daty teď není dostupný. Zkuste to později.";
  return "Data se nepodařilo načíst.";
}

export function curriculumSaveError(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case "curriculum_changed":
        return "Data se mezitím změnila. Načetl jsem aktuální verzi, zopakujte prosím změnu.";
      case "curriculum_sme_required":
        return "Ověřovat může jen správce zapsaný jako odborník (SME).";
      case "curriculum_record_deprecated":
        return "Odebraný záznam nelze vrátit.";
      case "curriculum_repository_unavailable":
        return "Repozitář s daty teď není dostupný, změna nebyla uložena.";
      case "curriculum_editing_disabled":
        return "Úpravy dat z aplikace jsou na serveru vypnuté.";
    }
  }
  return "Změnu se nepodařilo uložit.";
}

function matchesSearch(product: PreparationProductionProduct, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase("cs");
  if (needle.length === 0) return true;
  return (
    product.nameCs.toLocaleLowerCase("cs").includes(needle) ||
    product.formula.toLocaleLowerCase("cs").includes(needle) ||
    product.routes.some((route) =>
      [...route.reactants, ...route.products].some((term) =>
        term.formula.toLocaleLowerCase("cs").includes(needle),
      ),
    )
  );
}

export function CurriculumReview() {
  const account = useAccount();
  const allowed = account?.role === "admin";
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState<OpenForm | null>(null);
  // The owner works through one document at a time, so the last evidence is reused.
  const [evidence, setEvidence] = useState<ReviewEvidence>({ evidence: "", confirmedBy: "" });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const curriculum = useQuery({
    queryKey: queryKeys.admin.preparationProductionCurriculum,
    queryFn: getPreparationProductionCurriculum,
    enabled: allowed,
    retry: false,
  });
  const products = useMemo(() => {
    try {
      return curriculum.data?.products.map(toFileProduct) ?? [];
    } catch {
      return null;
    }
  }, [curriculum.data]);
  const counts = useMemo(() => countReviewStates(products ?? []), [products]);

  if (!allowed) return null;

  const busy = saving || curriculum.isFetching;
  const canValidate = curriculum.data?.canValidate ?? false;

  async function save(body: () => Promise<ProductInput>, success: string) {
    if (!curriculum.data) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await savePreparationProductionProduct(await body(), curriculum.data.fileSha);
      setOpenForm(null);
      setEditing(null);
      setMessage(success);
    } catch (cause) {
      setError(curriculumSaveError(cause));
    } finally {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.preparationProductionCurriculum,
      });
      setSaving(false);
    }
  }

  function runAction(
    product: PreparationProductionProduct,
    target: ReviewTarget,
    action: ReviewAction,
  ) {
    return save(
      () => applyReviewAction(product, target, action),
      action.kind === "validate"
        ? "Ověření bylo uloženo do pull requestu."
        : action.kind === "remove"
          ? "Záznam byl odebrán v pull requestu."
          : "Ověření bylo zrušeno v pull requestu.",
    );
  }

  function saveEdit(product: PreparationProductionProduct) {
    void save(async () => toProductInput(product), "Změna byla uložena do pull requestu.");
  }

  function startEditing(next: Editing) {
    setOpenForm(null);
    setMessage("");
    setError("");
    setEditing(next);
  }

  function isEditing(next: Editing): boolean {
    return editing !== null && editingKey(editing) === editingKey(next);
  }

  function submitValidation(
    event: FormEvent<HTMLFormElement>,
    product: PreparationProductionProduct,
    target: ReviewTarget,
  ) {
    event.preventDefault();
    void runAction(product, target, { kind: "validate", evidence });
  }

  function renderActions(product: PreparationProductionProduct, target: ReviewTarget) {
    const actions = availableActions(product, target);
    const key = targetKey(product.id, target);
    const open =
      openForm !== null && targetKey(openForm.productId, openForm.target) === key
        ? openForm.kind
        : null;
    if (actions.length === 0) return null;

    if (open === "validate")
      return (
        <form
          className="mt-3 grid gap-3 rounded-xl border bg-surface-2 p-3 sm:grid-cols-2"
          onSubmit={(event) => submitValidation(event, product, target)}
        >
          <label className="grid gap-1 font-medium">
            Doklad (dokument, strana)
            <input
              className="min-h-11 rounded-xl border bg-surface px-3"
              maxLength={300}
              onChange={(event) => setEvidence({ ...evidence, evidence: event.target.value })}
              required
              value={evidence.evidence}
            />
          </label>
          <label className="grid gap-1 font-medium">
            Potvrdil (nepovinné, bude veřejné)
            <input
              className="min-h-11 rounded-xl border bg-surface px-3"
              maxLength={120}
              onChange={(event) => setEvidence({ ...evidence, confirmedBy: event.target.value })}
              value={evidence.confirmedBy}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50"
              disabled={busy || evidence.evidence.trim().length === 0}
              type="submit"
            >
              Potvrdit ověření
            </button>
            <button className={BUTTON} onClick={() => setOpenForm(null)} type="button">
              Zrušit
            </button>
          </div>
        </form>
      );

    if (open === "remove")
      return (
        <fieldset className="mt-3 grid gap-3 rounded-xl border border-bad bg-bad-soft p-3">
          <legend className="sr-only">Potvrzení odebrání</legend>
          <p>
            Odebraný záznam nelze vrátit a jeho ID se už nepoužije. Studenti ho přestanou vidět po
            sloučení pull requestu a vydání nové verze.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-xl bg-bad px-4 font-semibold text-on-fill disabled:opacity-50"
              disabled={busy}
              onClick={() => void runAction(product, target, { kind: "remove" })}
              type="button"
            >
              Odebrat natrvalo
            </button>
            <button className={BUTTON} onClick={() => setOpenForm(null)} type="button">
              Zrušit
            </button>
          </div>
        </fieldset>
      );

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.includes("validate") && canValidate ? (
          <button
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setOpenForm({ productId: product.id, target, kind: "validate" });
            }}
            type="button"
          >
            Ověřit
          </button>
        ) : null}
        {actions.includes("unvalidate") ? (
          <button
            className={BUTTON}
            disabled={busy}
            onClick={() => void runAction(product, target, { kind: "unvalidate" })}
            type="button"
          >
            Zrušit ověření
          </button>
        ) : null}
        {actions.includes("remove") ? (
          <button
            className={`${BUTTON} text-bad`}
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setOpenForm({ productId: product.id, target, kind: "remove" });
            }}
            type="button"
          >
            Odebrat
          </button>
        ) : null}
      </div>
    );
  }

  const visible = (products ?? [])
    .filter((product) => matchesSearch(product, search))
    .map((product) => ({
      product,
      productShown: filter === "all" || reviewState(product) === filter,
      routes: product.routes.filter(
        (route) => filter === "all" || routeReviewState(product, route) === filter,
      ),
    }))
    .filter(({ productShown, routes }) => productShown || routes.length > 0);

  return (
    <section aria-label="Příprava a výroba">
      <p className="mb-4 max-w-[65ch] text-ink-2">
        Rovnice přípravy a výroby. Ověřením potvrzujete záznam podle dokladu. Změny se ukládají do
        jednoho pull requestu; studenti je uvidí po jeho sloučení a vydání nové verze. Neověřené
        záznamy studenti vidí dál.
      </p>

      {curriculum.data && products === null ? (
        <p className="text-bad" role="alert">
          Data v repozitáři neodpovídají schématu. Opravte je v pull requestu a zkuste to znovu.
        </p>
      ) : curriculum.data ? (
        <>
          {curriculum.data.pullRequestUrl ? (
            <p className="rounded-xl border bg-surface p-3">
              Uložené změny čekají v{" "}
              <a
                className="font-semibold text-accent-strong underline"
                href={curriculum.data.pullRequestUrl}
                rel="noreferrer"
                target="_blank"
              >
                pull requestu s úpravami dat
              </a>
              . Po kontrole CI ho slučte, změny pak vyjdou v další verzi.
            </p>
          ) : null}
          {canValidate ? null : (
            <p className="mt-3 rounded-xl border border-warn bg-warn-soft p-3">
              Váš účet není zapsán jako odborník (SME), proto nemůžete ověřovat. Odebrat záznam nebo
              zrušit ověření můžete.
            </p>
          )}

          <section aria-label="Přehled ověření" className="mt-4 grid gap-1 text-ink-2">
            <p>
              Rovnice: {counts.routes.validated} ověřeno · {counts.routes.pending} čeká ·{" "}
              {counts.routes.removed} odebráno
            </p>
            <p>
              Látky: {counts.products.validated} ověřeno · {counts.products.pending} čeká ·{" "}
              {counts.products.removed} odebráno
            </p>
          </section>

          <fieldset className="mt-4">
            <legend className="font-semibold text-ink">Zobrazit</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FILTERS.map((option) => {
                const on = filter === option.value;
                const count =
                  option.value === "all"
                    ? counts.routes.validated + counts.routes.pending + counts.routes.removed
                    : counts.routes[option.value];
                return (
                  <button
                    aria-pressed={on}
                    className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                    <span className="font-normal text-ink-2">({count})</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="mt-4 grid max-w-md gap-1 font-medium">
            Hledat látku nebo vzorec
            <input
              className="min-h-11 rounded-xl border px-3"
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              value={search}
            />
          </label>

          <div className="mt-4">
            <button
              className={BUTTON}
              disabled={busy}
              onClick={() => startEditing({ kind: "product", productId: null })}
              type="button"
            >
              Přidat látku
            </button>
            {isEditing({ kind: "product", productId: null }) ? (
              <ProductEditor
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={saveEdit}
                product={null}
                products={products ?? []}
              />
            ) : null}
          </div>

          <div aria-live="polite" className="mt-4 min-h-6">
            {message ? <p className="text-good">{message}</p> : null}
            {curriculum.isFetching && !saving ? <p>Načítám aktuální data…</p> : null}
          </div>
          {error ? (
            <p className="text-bad" role="alert">
              {error}
            </p>
          ) : null}

          {visible.length === 0 ? (
            <p className="mt-4">V tomto výběru nic není.</p>
          ) : (
            <ul className="mt-4 grid gap-4">
              {visible.map(({ product, productShown, routes }) => (
                <li className="rounded-2xl border bg-surface p-4" key={product.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      {product.nameCs} (<Formula formula={product.formula} />)
                    </h2>
                    <StateBadge state={reviewState(product)} />
                  </div>
                  {productShown ? (
                    <>
                      <ReviewDetails record={product} />
                      <p className="mt-1 text-sm text-ink-2">
                        Ověření látky potvrzuje název, vzorec, poznámky a zdroje.
                      </p>
                      {renderActions(product, { kind: "product" })}
                    </>
                  ) : null}
                  {product.status === "deprecated" ? null : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={BUTTON}
                        disabled={busy}
                        onClick={() => startEditing({ kind: "product", productId: product.id })}
                        type="button"
                      >
                        Upravit látku
                      </button>
                      <button
                        className={BUTTON}
                        disabled={busy}
                        onClick={() =>
                          startEditing({ kind: "route", productId: product.id, routeId: null })
                        }
                        type="button"
                      >
                        Přidat rovnici
                      </button>
                    </div>
                  )}
                  {isEditing({ kind: "product", productId: product.id }) ? (
                    <ProductEditor
                      busy={busy}
                      onCancel={() => setEditing(null)}
                      onSave={saveEdit}
                      product={product}
                      products={products ?? []}
                    />
                  ) : null}
                  {isEditing({ kind: "route", productId: product.id, routeId: null }) ? (
                    <RouteEditor
                      busy={busy}
                      onCancel={() => setEditing(null)}
                      onSave={saveEdit}
                      product={product}
                      products={products ?? []}
                      routeId={null}
                    />
                  ) : null}
                  {routes.length > 0 ? (
                    <ul className="mt-4 grid gap-3 border-t pt-3">
                      {routes.map((route) => (
                        <li key={route.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-lg">
                              <Equation products={route.products} reactants={route.reactants} />
                            </p>
                            <StateBadge state={routeReviewState(product, route)} />
                          </div>
                          <p className="text-sm text-ink-2">
                            {route.kind === "preparation" ? "Příprava" : "Výroba"}
                            {route.conditionsCs ? ` · podmínky: ${route.conditionsCs}` : ""} ·{" "}
                            {route.sourceId}
                          </p>
                          {route.status === "in-review" ? (
                            <p className="text-sm text-warn">
                              Vyřazeno z výuky: {route.reviewNote}
                            </p>
                          ) : null}
                          <ReviewDetails record={route} />
                          {renderActions(product, { kind: "route", routeId: route.id })}
                          {product.status === "deprecated" ||
                          route.status === "deprecated" ? null : (
                            <button
                              className={`${BUTTON} mt-2`}
                              disabled={busy}
                              onClick={() =>
                                startEditing({
                                  kind: "route",
                                  productId: product.id,
                                  routeId: route.id,
                                })
                              }
                              type="button"
                            >
                              Upravit rovnici
                            </button>
                          )}
                          {isEditing({
                            kind: "route",
                            productId: product.id,
                            routeId: route.id,
                          }) ? (
                            <RouteEditor
                              busy={busy}
                              onCancel={() => setEditing(null)}
                              onSave={saveEdit}
                              product={product}
                              products={products ?? []}
                              routeId={route.id}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p
          className={curriculum.isError ? "text-bad" : ""}
          role={curriculum.isError ? "alert" : "status"}
        >
          {curriculum.isError ? curriculumLoadError(curriculum.error) : "Načítám data…"}
        </p>
      )}
    </section>
  );
}

function StateBadge({ state }: Readonly<{ state: ReviewState }>) {
  return (
    <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATE_CLASSES[state]}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

function ReviewDetails({
  record,
}: Readonly<{ record: PreparationProductionProduct | PreparationProductionRoute }>) {
  if (record.status !== "reviewed") return null;
  return (
    <p className="mt-1 text-sm text-ink-2">
      Ověřeno {record.reviewedAt ? new Date(record.reviewedAt).toLocaleDateString("cs-CZ") : ""}
      {record.reviewEvidence ? ` · doklad: ${record.reviewEvidence}` : ""}
      {record.reviewEvidenceConfirmedBy ? ` · potvrdil: ${record.reviewEvidenceConfirmedBy}` : ""}
    </p>
  );
}
