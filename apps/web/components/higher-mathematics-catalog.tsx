import Link from "next/link";

import type { MathTopic } from "@inorganic/content/higher-mathematics";

export function HigherMathematicsCatalog({ topics }: Readonly<{ topics: readonly MathTopic[] }>) {
  return (
    <section aria-labelledby="higher-mathematics-title" className="mt-10">
      <header className="mb-4">
        <h2
          className="font-display text-2xl font-bold tracking-tight text-ink"
          id="higher-mathematics-title"
        >
          Vyšší matematika
        </h2>
        <p className="mt-1 text-ink-2">
          Devět tematických okruhů s procvičováním, nápovědou a úplným řešením.
        </p>
      </header>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic, index) => (
          <li className="h-full" key={topic.id}>
            <Link
              className="group flex h-full min-h-48 flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href={`/procvicovani/matematika/${topic.id}`}
            >
              <span
                className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-surface-2 font-mono text-sm font-semibold text-accent-strong"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-lg font-bold text-ink group-hover:text-accent-strong">
                {topic.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-2">{topic.description}</p>
              <span className="mt-auto pt-4 text-sm font-semibold text-accent-strong">
                Otevřít okruh <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
