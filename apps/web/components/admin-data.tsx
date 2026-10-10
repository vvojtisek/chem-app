"use client";

import { useState } from "react";
import { useAccount } from "@/components/auth-gate";
import { CurriculumReview } from "@/components/curriculum-review";
import { NomenclatureReview } from "@/components/nomenclature-review";
import { PageHeader } from "@/components/page-header";

type Dataset = "preparation-production" | "nomenclature";

const DATASETS: readonly { readonly value: Dataset; readonly label: string }[] = [
  { value: "preparation-production", label: "Příprava a výroba" },
  { value: "nomenclature", label: "Názvosloví" },
];

/** The admin data screen: one dataset at a time, each saved to the same pull request. */
export function AdminData() {
  const account = useAccount();
  const [dataset, setDataset] = useState<Dataset>("preparation-production");

  if (account?.role !== "admin")
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 lg:py-10">
        <PageHeader description="Správa je dostupná pouze správci." title="Přístup odepřen" />
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader
        breadcrumbs={[{ label: "Správa", href: "/admin" }, { label: "Data" }]}
        title="Data a ověřování obsahu"
      />
      <fieldset className="mb-6">
        <legend className="sr-only">Sada dat</legend>
        <div className="flex flex-wrap gap-2">
          {DATASETS.map((option) => (
            <button
              aria-pressed={dataset === option.value}
              className={`min-h-11 rounded-xl border-2 px-4 font-semibold ${
                dataset === option.value
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line-strong bg-surface text-ink-2"
              }`}
              key={option.value}
              onClick={() => setDataset(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      {dataset === "nomenclature" ? <NomenclatureReview /> : <CurriculumReview />}
    </main>
  );
}
