import { type EquationTerm, parseEquationAnswer } from "@inorganic/chemistry";
import type {
  PreparationProductionProduct,
  PreparationProductionRoute,
} from "@inorganic/content/preparation-production-schema";
import {
  findPreparationProductionProblems,
  type PreparationProductionProblem,
} from "@inorganic/content/preparation-production-validation";
import { reviewFingerprintPayload } from "@inorganic/content/review-fingerprint";
import { curatedElements } from "@inorganic/content/runtime";

const PRODUCT_ID_PREFIX = "preparation-production.product.";
const ROUTE_ID_PREFIX = "preparation-production.route.";
const REVIEW_KEYS = [
  "reviewedBy",
  "reviewedAt",
  "reviewFingerprint",
  "reviewEvidence",
  "reviewEvidenceConfirmedBy",
] as const;

const elementSymbols: ReadonlySet<string> = new Set(
  curatedElements.map((element) => element.symbol),
);

export interface RouteDraft {
  readonly kind: PreparationProductionRoute["kind"];
  readonly equation: string;
  readonly conditions: string;
  readonly sourceId: string;
}

export interface ProductDraft {
  readonly nameCs: string;
  readonly formula: string;
  readonly noteKind: PreparationProductionRoute["kind"];
  readonly note: string;
  readonly sourceTitle: string;
  readonly sourceLocator: string;
}

export type EditResult =
  | { readonly ok: true; readonly product: PreparationProductionProduct }
  | { readonly ok: false; readonly errors: readonly string[] };

const PROBLEM_MESSAGES: Record<PreparationProductionProblem["code"], string> = {
  duplicate_product_id: "Látka s tímto ID už existuje.",
  duplicate_route_id: "Rovnice s tímto ID už existuje.",
  invalid_product_formula: "Vzorec látky obsahuje neznámý prvek nebo chybný zápis.",
  missing_source: "Látka potřebuje alespoň jeden zdroj.",
  unreviewed_route_without_note: "Pozastavená rovnice potřebuje důvod.",
  invalid_equation_formula: "Rovnice obsahuje neznámý prvek nebo chybný vzorec.",
  invalid_equation_alias: "Alternativní zápis vzorce neodpovídá vzorci.",
  unbalanced_approved_equation: "Rovnice není vyčíslená: počty atomů na obou stranách se liší.",
  unreduced_approved_equation:
    "Koeficienty nejsou v nejmenším poměru (vydělte je společným dělitelem).",
};

/** The equation as the owner types it: `Zn + 2 HCl -> ZnCl2 + H2`. */
export function equationText(route: Pick<PreparationProductionRoute, "reactants" | "products">) {
  const side = (terms: readonly EquationTerm[]) =>
    terms
      .map((term) =>
        term.coefficient === 1 ? term.formula : `${term.coefficient} ${term.formula}`,
      )
      .join(" + ");
  return `${side(route.reactants)} -> ${side(route.products)}`;
}

export function routeDraft(route?: PreparationProductionRoute): RouteDraft {
  return {
    kind: route?.kind ?? "preparation",
    equation: route ? equationText(route) : "",
    conditions: route?.conditionsCs ?? "",
    sourceId: route?.sourceId ?? "",
  };
}

export function productDraft(product?: PreparationProductionProduct): ProductDraft {
  const note = product?.notes[0];
  const source = product?.sources[0];
  return {
    nameCs: product?.nameCs ?? "",
    formula: product?.formula ?? "",
    noteKind: note?.kind ?? "preparation",
    note: note?.text ?? "",
    sourceTitle: source?.title ?? "",
    sourceLocator: source?.locator ?? "",
  };
}

/** Lowercase ASCII words joined by hyphens, as in the existing record IDs. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/**
 * A fresh ID that no record in the file uses, removed ones included: an ID is
 * never reused, so learner progress can never attach to a different record.
 */
function freshId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function allRouteIds(products: readonly PreparationProductionProduct[]): Set<string> {
  return new Set(products.flatMap((product) => product.routes.map((route) => route.id)));
}

/** A free source label for an equation added from the console (`id-admin-N`). */
export function nextAdminSourceId(products: readonly PreparationProductionProduct[]): string {
  const used = new Set(
    products.flatMap((product) => product.routes.map((route) => route.sourceId)),
  );
  let number = 1;
  while (used.has(`id-admin-${number}`)) number += 1;
  return `id-admin-${number}`;
}

/**
 * Add a route to a product, or replace one, and check it as CI will.
 *
 * Any change to a route clears its validation: the fingerprint no longer
 * matches, so the SME must confirm the new content.
 */
export function editRoute(
  products: readonly PreparationProductionProduct[],
  product: PreparationProductionProduct,
  routeId: string | null,
  draft: RouteDraft,
): EditResult {
  const errors: string[] = [];
  const parsed = parseEquationAnswer(draft.equation);
  if (!parsed)
    errors.push("Rovnici se nepodařilo přečíst. Použijte tvar „Zn + 2 HCl -> ZnCl2 + H2“.");
  const conditions = draft.conditions.trim();
  if (conditions.length > 120) errors.push("Podmínky mohou mít nejvýše 120 znaků.");
  const sourceId = draft.sourceId.trim();
  if (!/^id-[a-z0-9-]+$/u.test(sourceId) || sourceId.length > 100)
    errors.push(
      "Označení v prameni musí začínat „id-“ a obsahovat jen malá písmena, číslice a pomlčky.",
    );
  if (!parsed || errors.length > 0) return { ok: false, errors };

  const previous =
    routeId === null ? undefined : product.routes.find((route) => route.id === routeId);
  const aliases = new Map(
    [...(previous?.reactants ?? []), ...(previous?.products ?? [])]
      .filter((term) => term.acceptedAliases !== undefined)
      .map((term) => [term.formula, term.acceptedAliases] as const),
  );
  const withAliases = (terms: readonly EquationTerm[]) =>
    terms.map((term) => {
      const accepted = aliases.get(term.formula);
      return accepted === undefined
        ? { coefficient: term.coefficient, formula: term.formula }
        : { coefficient: term.coefficient, formula: term.formula, acceptedAliases: accepted };
    });
  const productSlug = product.id.slice(PRODUCT_ID_PREFIX.length);
  const route: PreparationProductionRoute = {
    id:
      previous?.id ??
      freshId(`${ROUTE_ID_PREFIX}${productSlug}-${sourceId}-${draft.kind}`, allRouteIds(products)),
    sourceId,
    kind: draft.kind,
    reactants: withAliases(parsed.reactants),
    products: withAliases(parsed.products),
    conditionsCs: conditions.length > 0 ? conditions : null,
    status: "owner-approved",
  };
  if (
    previous !== undefined &&
    previous.status !== "in-review" &&
    reviewFingerprintPayload(previous) === reviewFingerprintPayload(route)
  ) {
    // Nothing the review covers changed, so the validation stays.
    return checked(product);
  }
  const routes =
    previous === undefined
      ? [...product.routes, route]
      : product.routes.map((item) => (item.id === previous.id ? route : item));
  return checked({ ...product, routes });
}

/**
 * Create a product with its first route, or change a product's own fields.
 *
 * The route attestation covers the product name, formula and sources, so a
 * change to those clears the validation of the product and of every route.
 */
export function editProduct(
  products: readonly PreparationProductionProduct[],
  product: PreparationProductionProduct | null,
  draft: ProductDraft,
  firstRoute: RouteDraft | null,
  today: string,
): EditResult {
  const errors: string[] = [];
  const nameCs = draft.nameCs.trim();
  const formula = draft.formula.replace(/\s+/gu, "");
  const note = draft.note.trim();
  const sourceTitle = draft.sourceTitle.trim();
  const sourceLocator = draft.sourceLocator.trim();
  if (nameCs.length === 0 || nameCs.length > 120) errors.push("Název musí mít 1 až 120 znaků.");
  if (formula.length === 0 || formula.length > 256) errors.push("Vyplňte vzorec látky.");
  if (note.length > 2000) errors.push("Poznámka může mít nejvýše 2000 znaků.");
  if (sourceTitle.length === 0 || sourceTitle.length > 300)
    errors.push("Název zdroje musí mít 1 až 300 znaků.");
  if (!isHttpsUrl(sourceLocator)) errors.push("Odkaz na zdroj musí být adresa https://.");
  const slug = slugify(nameCs);
  if (product === null && slug.length === 0)
    errors.push("Z názvu nejde vytvořit ID. Použijte písmena nebo číslice.");
  if (errors.length > 0) return { ok: false, errors };

  const source = { title: sourceTitle, locator: sourceLocator };
  const fields = {
    nameCs,
    formula,
    notes: [
      ...(note.length > 0 ? [{ kind: draft.noteKind, text: note }] : []),
      ...(product?.notes.slice(1) ?? []),
    ],
    sources: [source, ...(product?.sources.slice(1) ?? [])],
  };

  if (product === null) {
    const created: PreparationProductionProduct = {
      id: freshId(`${PRODUCT_ID_PREFIX}${slug}`, new Set(products.map(({ id }) => id))),
      ...fields,
      routes: [],
      status: "owner-approved",
      // The server sets author and owner approval for a new product.
      author: "Admin console",
      ownerApprovedBy: "Content owner via the admin console",
      ownerApprovedAt: today,
    };
    if (firstRoute === null) return checked(created);
    return editRoute([...products, created], created, null, firstRoute);
  }

  const identityChanged =
    product.nameCs !== nameCs ||
    product.formula !== formula ||
    JSON.stringify(product.sources) !== JSON.stringify(fields.sources);
  const notesChanged = JSON.stringify(product.notes) !== JSON.stringify(fields.notes);
  const edited: PreparationProductionProduct = {
    ...(identityChanged || notesChanged ? withoutReview(product) : product),
    ...fields,
    routes: identityChanged ? product.routes.map(withoutReview) : product.routes,
  };
  return checked(edited);
}

/** How many validations a product change would clear. */
export function clearedValidations(
  product: PreparationProductionProduct,
  draft: ProductDraft,
): number {
  const result = editProduct([product], product, draft, null, "");
  if (!result.ok) return 0;
  const before = [product, ...product.routes].filter((record) => record.status === "reviewed");
  const after = [result.product, ...result.product.routes].filter(
    (record) => record.status === "reviewed",
  );
  return before.length - after.length;
}

function withoutReview<T extends { readonly status: string }>(record: T): T {
  if (record.status !== "reviewed") return record;
  const copy: Record<string, unknown> = { ...record, status: "owner-approved" };
  for (const key of REVIEW_KEYS) delete copy[key];
  return copy as T;
}

function checked(product: PreparationProductionProduct): EditResult {
  const problems = findPreparationProductionProblems([product], elementSymbols);
  if (problems.length === 0) return { ok: true, product };
  return {
    ok: false,
    errors: [...new Set(problems.map((problem) => PROBLEM_MESSAGES[problem.code]))],
  };
}

function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\/\S+$/u.test(value) || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
