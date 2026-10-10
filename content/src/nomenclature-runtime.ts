import { createHash } from "node:crypto";
import type { NomenclatureRecord, NomenclatureRuntimeRecord } from "./nomenclature-schema";
import {
  buildNomenclatureCompounds,
  NOMENCLATURE_VERSION_PREFIX,
  nomenclatureVersionPayload,
} from "./nomenclature-snapshot";

export {
  deriveAnionFamily,
  type NomenclatureProblem,
  validateNomenclatureRecords,
} from "./nomenclature-snapshot";

export function createNomenclatureSnapshot(
  records: readonly NomenclatureRecord[],
  allowedSymbols: ReadonlySet<string>,
): {
  readonly schemaVersion: 3;
  readonly contentVersion: string;
  readonly compounds: readonly NomenclatureRuntimeRecord[];
} {
  const compounds = buildNomenclatureCompounds(records, allowedSymbols);
  const contentVersion =
    NOMENCLATURE_VERSION_PREFIX +
    createHash("sha256").update(nomenclatureVersionPayload(compounds)).digest("hex").slice(0, 12);
  return { schemaVersion: 3, contentVersion, compounds };
}
