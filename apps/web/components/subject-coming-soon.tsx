import Link from "next/link";

/** Empty state for a subject section that is not built yet. */
export function SubjectComingSoon({
  subject,
  title,
  children,
}: Readonly<{ subject: string; title: string; children: string }>) {
  return (
    <section
      aria-labelledby="coming-soon-heading"
      className="grid max-w-2xl gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="font-display text-lg font-bold text-ink" id="coming-soon-heading">
        {title}
      </h2>
      <p className="text-sm text-ink-2">{children}</p>
      <p>
        <Link
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-bold text-white hover:bg-accent-strong"
          href={`/predmety/${subject}`}
        >
          Přejít na učivo
        </Link>
      </p>
    </section>
  );
}
