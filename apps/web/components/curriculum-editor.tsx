"use client";

import type { PreparationProductionProduct } from "@inorganic/content/preparation-production-schema";
import { type FormEvent, useId, useState } from "react";
import {
  clearedValidations,
  type EditResult,
  editProduct,
  editRoute,
  nextAdminSourceId,
  type ProductDraft,
  productDraft,
  type RouteDraft,
  routeDraft,
} from "@/lib/curriculum-editing";

const INPUT = "min-h-11 rounded-xl border bg-surface px-3";
const PRIMARY = "min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50";
const SECONDARY = "min-h-11 rounded-xl border px-3 font-medium";

interface EditorProps {
  readonly products: readonly PreparationProductionProduct[];
  readonly busy: boolean;
  readonly onSave: (product: PreparationProductionProduct) => void;
  readonly onCancel: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Errors({ errors }: Readonly<{ errors: readonly string[] }>) {
  if (errors.length === 0) return null;
  return (
    <ul className="grid gap-1 text-bad sm:col-span-2" role="alert">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

function RouteFields({
  draft,
  onChange,
}: Readonly<{ draft: RouteDraft; onChange: (draft: RouteDraft) => void }>) {
  const hintId = useId();
  return (
    <>
      <div className="grid gap-1 sm:col-span-2">
        <label className="grid gap-1 font-medium">
          Rovnice
          <input
            aria-describedby={hintId}
            autoComplete="off"
            className={`${INPUT} font-mono`}
            maxLength={2000}
            onChange={(event) => onChange({ ...draft, equation: event.target.value })}
            placeholder="Zn + 2 HCl -> ZnCl2 + H2"
            required
            spellCheck={false}
            value={draft.equation}
          />
        </label>
        <span className="text-sm text-ink-2" id={hintId}>
          Koeficient před vzorcem, látky oddělené „+“, strany šipkou „-&gt;“.
        </span>
      </div>
      <label className="grid gap-1 font-medium">
        Typ
        <select
          className={INPUT}
          onChange={(event) =>
            onChange({ ...draft, kind: event.target.value as RouteDraft["kind"] })
          }
          value={draft.kind}
        >
          <option value="preparation">Příprava</option>
          <option value="manufacture">Výroba</option>
        </select>
      </label>
      <label className="grid gap-1 font-medium">
        Podmínky (nepovinné)
        <input
          className={INPUT}
          maxLength={120}
          onChange={(event) => onChange({ ...draft, conditions: event.target.value })}
          placeholder="t, katal."
          value={draft.conditions}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Označení v prameni
        <input
          className={`${INPUT} font-mono`}
          maxLength={100}
          onChange={(event) => onChange({ ...draft, sourceId: event.target.value })}
          required
          spellCheck={false}
          value={draft.sourceId}
        />
      </label>
    </>
  );
}

/** Add an equation to a product, or change one. */
export function RouteEditor({
  products,
  product,
  routeId,
  busy,
  onSave,
  onCancel,
}: EditorProps & {
  readonly product: PreparationProductionProduct;
  readonly routeId: string | null;
}) {
  const route = product.routes.find(({ id }) => id === routeId);
  const [draft, setDraft] = useState<RouteDraft>(() =>
    route ? routeDraft(route) : { ...routeDraft(), sourceId: nextAdminSourceId(products) },
  );
  const [errors, setErrors] = useState<readonly string[]>([]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = editRoute(products, product, routeId, draft);
    if (result.ok) onSave(result.product);
    else setErrors(result.errors);
  }

  return (
    <form
      aria-label={route ? "Upravit rovnici" : "Přidat rovnici"}
      className="mt-3 grid gap-3 rounded-xl border bg-surface-2 p-3 sm:grid-cols-2"
      onSubmit={submit}
    >
      <RouteFields draft={draft} onChange={setDraft} />
      {route?.status === "reviewed" ? (
        <p className="text-sm text-warn sm:col-span-2">
          Změna rovnice zruší její ověření; po uložení ji ověřte znovu.
        </p>
      ) : null}
      <Errors errors={errors} />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={PRIMARY} disabled={busy} type="submit">
          {route ? "Uložit rovnici" : "Přidat rovnici"}
        </button>
        <button className={SECONDARY} onClick={onCancel} type="button">
          Zrušit
        </button>
      </div>
    </form>
  );
}

/** Create a product with its first equation, or change a product's own fields. */
export function ProductEditor({
  products,
  product,
  busy,
  onSave,
  onCancel,
}: EditorProps & { readonly product: PreparationProductionProduct | null }) {
  const [draft, setDraft] = useState<ProductDraft>(() => productDraft(product ?? undefined));
  const [firstRoute, setFirstRoute] = useState<RouteDraft>(() => ({
    ...routeDraft(),
    sourceId: nextAdminSourceId(products),
  }));
  const [errors, setErrors] = useState<readonly string[]>([]);
  const cleared = product ? clearedValidations(product, draft) : 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result: EditResult = editProduct(
      products,
      product,
      draft,
      product ? null : firstRoute,
      today(),
    );
    if (result.ok) onSave(result.product);
    else setErrors(result.errors);
  }

  return (
    <form
      aria-label={product ? "Upravit látku" : "Přidat látku"}
      className="mt-3 grid gap-3 rounded-xl border bg-surface-2 p-3 sm:grid-cols-2"
      onSubmit={submit}
    >
      <label className="grid gap-1 font-medium">
        Název
        <input
          className={INPUT}
          maxLength={120}
          onChange={(event) => setDraft({ ...draft, nameCs: event.target.value })}
          required
          value={draft.nameCs}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Vzorec
        <input
          className={`${INPUT} font-mono`}
          maxLength={256}
          onChange={(event) => setDraft({ ...draft, formula: event.target.value })}
          required
          spellCheck={false}
          value={draft.formula}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Zdroj (název)
        <input
          className={INPUT}
          maxLength={300}
          onChange={(event) => setDraft({ ...draft, sourceTitle: event.target.value })}
          required
          value={draft.sourceTitle}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Zdroj (odkaz https://)
        <input
          className={INPUT}
          maxLength={2048}
          onChange={(event) => setDraft({ ...draft, sourceLocator: event.target.value })}
          required
          type="url"
          value={draft.sourceLocator}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Poznámka se týká
        <select
          className={INPUT}
          onChange={(event) =>
            setDraft({ ...draft, noteKind: event.target.value as ProductDraft["noteKind"] })
          }
          value={draft.noteKind}
        >
          <option value="preparation">Přípravy</option>
          <option value="manufacture">Výroby</option>
        </select>
      </label>
      <label className="grid gap-1 font-medium">
        Poznámka (nepovinné)
        <textarea
          className="min-h-11 rounded-xl border bg-surface px-3 py-2"
          maxLength={2000}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          rows={2}
          value={draft.note}
        />
      </label>
      {product ? null : (
        <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="font-semibold">První rovnice</legend>
          <RouteFields draft={firstRoute} onChange={setFirstRoute} />
        </fieldset>
      )}
      {cleared > 0 ? (
        <p className="text-sm text-warn sm:col-span-2">
          Uložení zruší ověření u {cleared} záznamů (látka a rovnice, které na názvu, vzorci nebo
          zdroji závisí); ověřte je pak znovu.
        </p>
      ) : null}
      <Errors errors={errors} />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={PRIMARY} disabled={busy} type="submit">
          {product ? "Uložit látku" : "Přidat látku"}
        </button>
        <button className={SECONDARY} onClick={onCancel} type="button">
          Zrušit
        </button>
      </div>
    </form>
  );
}
