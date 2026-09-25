"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function PageNavigation() {
  const router = useRouter();

  return (
    <nav aria-label="Navigace stránky" className="mb-6 flex flex-wrap gap-2">
      <button
        className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
        onClick={() => router.back()}
        type="button"
      >
        <span aria-hidden="true" className="mr-1">
          ←
        </span>{" "}
        Zpět
      </button>
      <Link
        className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
        href="/"
      >
        <span aria-hidden="true" className="mr-1">
          ⌂
        </span>{" "}
        Testy
      </Link>
    </nav>
  );
}
