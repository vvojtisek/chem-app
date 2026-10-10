import type { NomenclatureRecord } from "@inorganic/content/nomenclature-schema";
import { describe, expect, it } from "vitest";

import nomenclature from "../../../content/data/nomenclature.json";
import {
  canEditNomenclature,
  editNomenclatureRecord,
  type NomenclatureDraft,
  nextAdminRecordKey,
  nomenclatureDraft,
} from "./nomenclature-editing";

const records = nomenclature.records as unknown as NomenclatureRecord[];
const today = "2026-10-10";

function find(formula: string): NomenclatureRecord {
  const record = records.find((item) => item.formula === formula);
  if (!record) throw new Error(`No record ${formula}.`);
  return record;
}

const newDraft: NomenclatureDraft = {
  ...nomenclatureDraft(),
  formula: "RbI",
  nameCs: "jodid rubidný",
  explanationCs: "Kation Rb(+I) -> rubidný. Anion I(-I) -> jodid.",
  baseCategory: "binary-salt",
  sourceTitle: "Skripta",
  sourceLocator: "https://example.test/skripta",
};

function validated(record: NomenclatureRecord): NomenclatureRecord {
  return {
    ...record,
    status: "reviewed",
    reviewedBy: "reviewer.owner",
    reviewedAt: "2026-10-09",
    reviewFingerprint: `sha256:${"c".repeat(64)}`,
    reviewEvidence: "Skripta, s. 3",
  };
}

describe("editNomenclatureRecord", () => {
  it("keeps every published record unchanged when its draft is saved as loaded", () => {
    for (const record of records.filter(canEditNomenclature)) {
      expect(editNomenclatureRecord(records, record, nomenclatureDraft(record), today)).toEqual({
        ok: true,
        record,
      });
    }
  });

  it("adds a published record pending validation under a fresh console key", () => {
    const result = editNomenclatureRecord(records, null, newDraft, today);

    expect(result).toEqual({
      ok: true,
      record: expect.objectContaining({
        id: "nomenclature.admin-1",
        sourceKey: "admin-1",
        formula: "RbI",
        charge: 0,
        status: "owner-approved",
        disposition: "core-candidate",
        reviewIssues: [],
        directions: ["formula-to-name", "name-to-formula"],
        sources: [{ title: "Skripta", locator: "https://example.test/skripta", kind: "reference" }],
      }),
    });
  });

  it("never reuses the key of a removed console record", () => {
    const removed = { ...find("NaCl"), id: "nomenclature.admin-4", sourceKey: "admin-4" };
    expect(nextAdminRecordKey([...records, { ...removed, status: "deprecated" }])).toBe("admin-5");
  });

  it("clears the validation of a changed record and keeps an unchanged one", () => {
    const record = validated(find("NaCl"));
    const others = records.map((item) => (item.id === record.id ? record : item));

    const changed = editNomenclatureRecord(
      others,
      record,
      { ...nomenclatureDraft(record), explanationCs: "Na(+I) a Cl(-I)." },
      today,
    );
    expect(changed.ok && changed.record.status).toBe("owner-approved");
    expect(changed.ok && changed.record).not.toHaveProperty("reviewEvidence");
    expect(changed.ok && changed.record).not.toHaveProperty("reviewFingerprint");

    const unchanged = editNomenclatureRecord(others, record, nomenclatureDraft(record), today);
    expect(unchanged).toEqual({ ok: true, record });
  });

  it("refuses a name that another record already asks for", () => {
    const result = editNomenclatureRecord(
      records,
      null,
      { ...newDraft, formula: "NaCl2", nameCs: "chlorid  draselný" },
      today,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain(
      "Stejný název už má jiný záznam, odpověď by nebyla jednoznačná.",
    );
  });

  it("refuses a formula with an unknown element and stores a typed hydrate in canonical notation", () => {
    const unknown = editNomenclatureRecord(records, null, { ...newDraft, formula: "Xx2O" }, today);
    expect(!unknown.ok && unknown.errors.join(" ")).toMatch(/neznámý prvek/u);

    const hydrate = editNomenclatureRecord(
      records,
      null,
      { ...newDraft, formula: "SrCl2 . 6H2O", nameCs: "hexahydrát chloridu strontnatého" },
      today,
    );
    expect(hydrate.ok && hydrate.record.formula).toBe("SrCl2·6H2O");
  });

  it("asks for an ion only from formula to name", () => {
    const result = editNomenclatureRecord(records, null, { ...newDraft, charge: "-1" }, today);
    expect(!result.ok && result.errors).toContain("Ionty se procvičují jen ze vzorce na název.");

    const ion = editNomenclatureRecord(
      records,
      null,
      {
        ...newDraft,
        formula: "IO4",
        nameCs: "anion jodistanový",
        charge: "-1",
        directions: ["formula-to-name"],
      },
      today,
    );
    expect(ion.ok && ion.record.charge).toBe(-1);
  });

  it("requires a category, a direction and an https source for a new record", () => {
    const result = editNomenclatureRecord(
      records,
      null,
      { ...newDraft, baseCategory: "", directions: [], sourceLocator: "skripta.pdf" },
      today,
    );
    expect(!result.ok && result.errors).toEqual([
      "Vyberte kategorii.",
      "Vyberte alespoň jeden směr procvičování.",
      "Odkaz na zdroj musí začínat https://.",
    ]);
  });
});
