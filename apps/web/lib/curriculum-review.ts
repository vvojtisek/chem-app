import type { components } from "@inorganic/contracts";
import {
  type PreparationProductionProduct,
  type PreparationProductionRoute,
  preparationProductionProductSchema,
} from "@inorganic/content/preparation-production-schema";
import {
  productFingerprintInput,
  reviewFingerprintPayload,
  routeFingerprintInput,
} from "@inorganic/content/review-fingerprint";

export type StoredProduct = components["schemas"]["StoredProduct"];
export type ProductInput = components["schemas"]["ProductInput"];
export type RouteInput = components["schemas"]["RouteInput"];
type TermInput = components["schemas"]["EquationTerm"];

/** Where one record stands in the owner's one-by-one review. */
export type ReviewState = "validated" | "pending" | "removed";

export interface ReviewEvidence {
  readonly evidence: string;
  readonly confirmedBy: string;
}

export type ReviewAction =
  | { readonly kind: "validate"; readonly evidence: ReviewEvidence }
  | { readonly kind: "unvalidate" }
  | { readonly kind: "remove" };

/** Which record an action applies to: the product itself or one of its routes. */
export type ReviewTarget =
  | { readonly kind: "product" }
  | { readonly kind: "route"; readonly routeId: string };

export interface ReviewCounts {
  readonly validated: number;
  readonly pending: number;
  readonly removed: number;
}

export function reviewState(record: { readonly status: string }): ReviewState {
  if (record.status === "reviewed") return "validated";
  if (record.status === "deprecated") return "removed";
  return "pending";
}

/** A route of a removed product is removed for learners too. */
export function routeReviewState(
  product: PreparationProductionProduct,
  route: PreparationProductionRoute,
): ReviewState {
  return product.status === "deprecated" ? "removed" : reviewState(route);
}

/**
 * The actions the owner can take on one record in its current state.
 *
 * A route held for review (`in-review`) is excluded from lessons because its
 * source equation failed a check; it can only be removed here, never put back
 * into lessons by validating or un-validating it. A removed record stays removed.
 */
export function availableActions(
  product: PreparationProductionProduct,
  target: ReviewTarget,
): readonly ReviewAction["kind"][] {
  if (product.status === "deprecated") return [];
  const record =
    target.kind === "product"
      ? product
      : product.routes.find((route) => route.id === target.routeId);
  if (record === undefined) return [];
  if (record.status === "reviewed") return ["unvalidate", "remove"];
  if (record.status === "owner-approved") return ["validate", "remove"];
  if (record.status === "in-review") return ["remove"];
  return [];
}

/**
 * Restore the exact file shape of a product from the API response.
 *
 * The response lists absent optional fields as `null`; the file omits them. The
 * review fingerprint hashes the file shape, so the nulls must go before hashing.
 */
export function toFileProduct(stored: StoredProduct): PreparationProductionProduct {
  return preparationProductionProductSchema.parse(withoutNulls(stored));
}

function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => withoutNulls(item));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      // `conditionsCs` is the one field the file stores as an explicit null.
      .filter(([entryKey, entryValue]) => entryValue !== null || entryKey === "conditionsCs")
      .map(([entryKey, entryValue]) => [entryKey, withoutNulls(entryValue)]),
  );
}

export function countReviewStates(products: readonly PreparationProductionProduct[]): {
  readonly products: ReviewCounts;
  readonly routes: ReviewCounts;
} {
  const productCounts = { validated: 0, pending: 0, removed: 0 };
  const routeCounts = { validated: 0, pending: 0, removed: 0 };
  for (const product of products) {
    productCounts[reviewState(product)] += 1;
    for (const route of product.routes) routeCounts[routeReviewState(product, route)] += 1;
  }
  return { products: productCounts, routes: routeCounts };
}

export async function computeReviewFingerprint(record: object): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(reviewFingerprintPayload(record)),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"));
  return `sha256:${hex.join("")}`;
}

/**
 * Apply one review action and return the request body for the save endpoint.
 *
 * Reviewer and date are not sent: the server sets them from the signed-in SME
 * account and its own clock. Records the action does not touch keep their
 * evidence, so the server keeps their original reviewer and date.
 */
export async function applyReviewAction(
  product: PreparationProductionProduct,
  target: ReviewTarget,
  action: ReviewAction,
): Promise<ProductInput> {
  if (!availableActions(product, target).includes(action.kind)) {
    throw new Error(`Action ${action.kind} is not allowed for this record.`);
  }
  if (target.kind === "product") {
    const reviewed = await reviewFields(action, productFingerprintInput(product));
    return {
      ...toProductInput(product),
      status: statusAfter(action),
      ...reviewed,
    };
  }
  const input = toProductInput(product);
  const routes: RouteInput[] = [];
  for (const route of product.routes) {
    const routeInput = input.routes.find(({ id }) => id === route.id);
    if (routeInput === undefined) continue;
    if (route.id !== target.routeId) {
      routes.push(routeInput);
      continue;
    }
    const reviewed = await reviewFields(action, routeFingerprintInput(product, route));
    routes.push({ ...routeInput, status: statusAfter(action), ...reviewed });
  }
  return { ...input, routes };
}

function statusAfter(action: ReviewAction): "owner-approved" | "reviewed" | "deprecated" {
  if (action.kind === "validate") return "reviewed";
  if (action.kind === "remove") return "deprecated";
  return "owner-approved";
}

async function reviewFields(
  action: ReviewAction,
  fingerprintInput: object,
): Promise<
  Pick<ProductInput, "reviewFingerprint" | "reviewEvidence" | "reviewEvidenceConfirmedBy">
> {
  if (action.kind !== "validate") {
    return { reviewFingerprint: null, reviewEvidence: null, reviewEvidenceConfirmedBy: null };
  }
  const confirmedBy = action.evidence.confirmedBy.trim();
  return {
    reviewFingerprint: await computeReviewFingerprint(fingerprintInput),
    reviewEvidence: action.evidence.evidence.trim(),
    reviewEvidenceConfirmedBy: confirmedBy.length > 0 ? confirmedBy : null,
  };
}

export function toProductInput(product: PreparationProductionProduct): ProductInput {
  return {
    id: product.id,
    nameCs: product.nameCs,
    formula: product.formula,
    notes: product.notes,
    routes: product.routes.map(toRouteInput),
    status: product.status,
    sources: product.sources,
    reviewFingerprint: product.reviewFingerprint ?? null,
    reviewEvidence: product.reviewEvidence ?? null,
    reviewEvidenceConfirmedBy: product.reviewEvidenceConfirmedBy ?? null,
  };
}

function toRouteInput(route: PreparationProductionRoute): RouteInput {
  return {
    id: route.id,
    sourceId: route.sourceId,
    kind: route.kind,
    reactants: route.reactants.map(toTermInput),
    products: route.products.map(toTermInput),
    conditionsCs: route.conditionsCs,
    status: route.status,
    reviewNote: route.reviewNote ?? null,
    reviewFingerprint: route.reviewFingerprint ?? null,
    reviewEvidence: route.reviewEvidence ?? null,
    reviewEvidenceConfirmedBy: route.reviewEvidenceConfirmedBy ?? null,
  };
}

function toTermInput(term: PreparationProductionRoute["reactants"][number]): TermInput {
  return term.acceptedAliases === undefined
    ? { coefficient: term.coefficient, formula: term.formula }
    : {
        coefficient: term.coefficient,
        formula: term.formula,
        acceptedAliases: term.acceptedAliases,
      };
}
