import type { components } from "@inorganic/contracts";
import type { AttemptEvent } from "../browser-progress-store";
import { attemptGeneration } from "../progress-generation";

export type ApiAttempt = components["schemas"]["BatchRequest"]["events"][number];

/** Compile-time check against the generated OpenAPI union. */
export function mapAttempt(event: AttemptEvent): ApiAttempt {
  switch (event.mode) {
    case "element-name":
      return { ...event, progressGeneration: attemptGeneration(event) } satisfies ApiAttempt;
    case "periodic-table":
      return { ...event, progressGeneration: attemptGeneration(event) } satisfies ApiAttempt;
    case "nomenclature":
      return { ...event, progressGeneration: attemptGeneration(event) } satisfies ApiAttempt;
    case "equation":
      return { ...event, progressGeneration: attemptGeneration(event) } satisfies ApiAttempt;
  }
}
