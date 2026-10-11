"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { getCurriculumReviewerProfile, updateCurriculumReviewerProfile } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

const INPUT = "min-h-11 rounded-xl border bg-surface px-3";

/**
 * The SME's own public reviewer entry. A validation records it in the public content
 * repository, so the SME enters it themselves before their first validation.
 */
export function ReviewerProfile() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: queryKeys.admin.reviewerProfile,
    queryFn: getCurriculumReviewerProfile,
    retry: false,
  });
  const [editing, setEditing] = useState(false);
  const [publicName, setPublicName] = useState("");
  const [qualification, setQualification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!profile.data || profile.data.managedByConfiguration) return null;
  const registered = profile.data.reviewerId !== null;

  function startEditing() {
    setPublicName(profile.data?.publicName ?? "");
    setQualification(profile.data?.qualification ?? "");
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await updateCurriculumReviewerProfile({ publicName, qualification });
      queryClient.setQueryData(queryKeys.admin.reviewerProfile, saved);
      setEditing(false);
      // Whether the SME may validate comes with each dataset.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.preparationProductionCurriculum,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nomenclatureCurriculum }),
      ]);
    } catch {
      setError("Profil se nepodařilo uložit. Zkuste to znovu.");
    } finally {
      setSaving(false);
    }
  }

  if (registered && !editing)
    return (
      <p className="mb-6 rounded-xl border bg-surface p-3">
        Ověřujete jako <strong>{profile.data.publicName}</strong> ({profile.data.qualification}).{" "}
        <button
          className="font-semibold text-accent-strong underline"
          onClick={startEditing}
          type="button"
        >
          Upravit profil
        </button>
      </p>
    );

  if (!registered && !editing)
    return (
      <div className="mb-6 rounded-xl border border-warn bg-warn-soft p-3">
        <p>
          Než začnete ověřovat, vyplňte veřejný profil odborníka. Jméno a kvalifikace se zveřejní v
          repozitáři obsahu u každého vašeho ověření.
        </p>
        <button
          className="mt-2 min-h-11 rounded-xl border bg-surface px-3 font-medium"
          onClick={startEditing}
          type="button"
        >
          Vyplnit profil
        </button>
      </div>
    );

  return (
    <form
      aria-label="Profil odborníka"
      className="mb-6 grid gap-3 rounded-xl border bg-surface-2 p-3 sm:grid-cols-2"
      onSubmit={(event) => void save(event)}
    >
      <label className="grid gap-1 font-medium">
        Jméno (veřejné)
        <input
          autoComplete="name"
          className={INPUT}
          maxLength={120}
          onChange={(event) => setPublicName(event.target.value)}
          required
          value={publicName}
        />
      </label>
      <label className="grid gap-1 font-medium">
        Kvalifikace (veřejná)
        <input
          className={INPUT}
          maxLength={300}
          onChange={(event) => setQualification(event.target.value)}
          placeholder="např. Ph.D. anorganická chemie, VŠCHT"
          required
          value={qualification}
        />
      </label>
      <p className="text-sm text-ink-2 sm:col-span-2">
        Repozitář je veřejný: jméno a kvalifikace zůstanou i v jeho historii.
      </p>
      {error ? (
        <p className="text-bad sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-fill disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          Uložit profil
        </button>
        <button
          className="min-h-11 rounded-xl border px-3 font-medium"
          onClick={() => setEditing(false)}
          type="button"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
