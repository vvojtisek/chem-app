import { createHash } from "node:crypto";
import type { NomenclatureRecord } from "@inorganic/content/nomenclature-schema";
import { reviewFingerprintPayload } from "@inorganic/content/review-fingerprint";
import { describe, expect, it } from "vitest";

import snapshot from "../../../content/generated/nomenclature-runtime.json";
import nomenclature from "../../../content/data/nomenclature.json";
import {
  applyNomenclatureAction,
  availableNomenclatureActions,
  buildRuntimeSnapshot,
  countNomenclatureStates,
  type StoredNomenclatureRecord,
  toFileRecord,
} from "./nomenclature-review";

const fileRecords = nomenclature.records as unknown as Record<string, unknown>[];

/** What the API returns: absent optional fields as explicit nulls. */
function asApiResponse(record: Record<string, unknown>): StoredNomenclatureRecord {
  const optional = [
    "reviewedBy",
    "reviewedAt",
    "reviewFingerprint",
    "reviewEvidence",
    "reviewEvidenceConfirmedBy",
    "ownerApprovedBy",
    "ownerApprovedAt",
  ];
  return {
    ...Object.fromEntries(optional.map((key) => [key, null])),
    ...record,
  } as unknown as StoredNomenclatureRecord;
}

const records: NomenclatureRecord[] = fileRecords.map((record) =>
  toFileRecord(asApiResponse(record)),
);
const evidence = { evidence: " Skripta, s. 40 ", confirmedBy: "" };

function published(): NomenclatureRecord {
  const record = records.find((item) => item.status === "owner-approved");
  if (!record) throw new Error("fixture");
  return record;
}

describe("toFileRecord", () => {
  it("restores the exact file shape of every record from the API response", () => {
    expect(records).toEqual(fileRecords);
  });
});

describe("buildRuntimeSnapshot", () => {
  it("rebuilds the committed learner snapshot exactly, content version included", async () => {
    expect(await buildRuntimeSnapshot(records)).toEqual(snapshot);
  });
});

describe("applyNomenclatureAction", () => {
  it("validates with the CI fingerprint and marks the snapshot entry SME-reviewed", async () => {
    const record = published();
    const save = await applyNomenclatureAction(records, record, { kind: "validate", evidence });
    const expected = `sha256:${createHash("sha256")
      .update(reviewFingerprintPayload(record))
      .digest("hex")}`;

    expect(save.record).toMatchObject({
      id: record.id,
      status: "reviewed",
      reviewFingerprint: expected,
      reviewEvidence: "Skripta, s. 40",
      reviewEvidenceConfirmedBy: null,
    });
    expect(save.record).not.toHaveProperty("author");
    expect(save.record).not.toHaveProperty("ownerApprovedBy");
    expect(save.runtimeSnapshot.compounds.find(({ id }) => id === record.id)?.reviewLevel).toBe(
      "sme-reviewed",
    );
    expect(save.runtimeSnapshot.contentVersion).not.toBe(snapshot.contentVersion);
  });

  it("removes a record from the learner snapshot", async () => {
    const record = published();
    const save = await applyNomenclatureAction(records, record, { kind: "remove" });

    expect(save.record.status).toBe("deprecated");
    expect(save.runtimeSnapshot.compounds).toHaveLength(snapshot.compounds.length - 1);
  });

  it("withdraws a validation back to owner-approved", async () => {
    const reviewed: NomenclatureRecord = {
      ...published(),
      status: "reviewed",
      reviewedBy: "reviewer.owner",
      reviewedAt: "2026-10-10",
      reviewFingerprint: `sha256:${"a".repeat(64)}`,
      reviewEvidence: "Skripta",
    };
    const all = records.map((item) => (item.id === reviewed.id ? reviewed : item));
    const save = await applyNomenclatureAction(all, reviewed, { kind: "unvalidate" });

    expect(save.record).toMatchObject({
      status: "owner-approved",
      reviewFingerprint: null,
      reviewEvidence: null,
    });
    expect(await buildRuntimeSnapshot(records)).toEqual(save.runtimeSnapshot);
  });

  it("never publishes a draft by validating it", async () => {
    const draft = records.find((item) => item.status === "draft");
    if (!draft) throw new Error("fixture");

    expect(availableNomenclatureActions(draft)).toEqual(["remove"]);
    await expect(
      applyNomenclatureAction(records, draft, { kind: "validate", evidence }),
    ).rejects.toThrow();
  });
});

describe("countNomenclatureStates", () => {
  it("separates published, unpublished and removed records", () => {
    expect(countNomenclatureStates(records)).toEqual({
      validated: 0,
      pending: 469,
      unpublished: 41,
      removed: 0,
    });
  });
});
