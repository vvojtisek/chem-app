import Link from "next/link";

export const PRACTICE_HUB_HREF = "/procvicovani";

interface PracticeNavigationProps {
  /** Where „Zpět“ leads; omit it on the practice hub itself, which only needs „Testy“. */
  readonly backHref?: string | undefined;
}

export function PracticeNavigation({ backHref }: PracticeNavigationProps) {
  return (
    <nav
      aria-label="Navigace procvičování"
      className="sticky top-0 z-20 -mx-5 mb-6 flex gap-2 border-b border-line bg-surface-2/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8"
    >
      {backHref ? (
        <Link
          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
          href={backHref}
        >
          <span aria-hidden="true">←</span> Zpět
        </Link>
      ) : null}
      <Link
        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line-strong bg-surface px-4 font-semibold text-ink"
        href="/"
      >
        <span aria-hidden="true">⌂</span> Testy
      </Link>
    </nav>
  );
}
