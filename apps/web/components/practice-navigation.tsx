import Link from "next/link";

export const PRACTICE_HUB_HREF = "/procvicovani";

interface PracticeNavigationProps {
  /** Where „Zpět“ leads; omit it on the practice hub itself, which only needs „Domů“. */
  readonly backHref?: string | undefined;
}

export function PracticeNavigation({ backHref }: PracticeNavigationProps) {
  return (
    <nav
      aria-label="Navigace procvičování"
      className="sticky top-0 z-20 -mx-5 mb-6 flex gap-2 border-b border-slate-200 bg-slate-50/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8"
    >
      {backHref ? (
        <Link
          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900"
          href={backHref}
        >
          <span aria-hidden="true">←</span> Zpět
        </Link>
      ) : null}
      <Link
        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900"
        href="/"
      >
        <span aria-hidden="true">⌂</span> Domů
      </Link>
    </nav>
  );
}
