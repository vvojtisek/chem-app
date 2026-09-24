import type { components } from "@inorganic/contracts";
import type { AttemptEvent } from "../browser-progress-store";

export type ApiAttempt = components["schemas"]["BatchRequest"]["events"][number];

/** Compile-time check against the generated OpenAPI union. */
export function mapAttempt(event: AttemptEvent): ApiAttempt {
  switch (event.mode) {
    case "element-name":
      return event satisfies ApiAttempt;
    case "periodic-table":
      return event satisfies ApiAttempt;
    case "nomenclature":
      return event satisfies ApiAttempt;
    case "equation":
      return event satisfies ApiAttempt;
  }
}
