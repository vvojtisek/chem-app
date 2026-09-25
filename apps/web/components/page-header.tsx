import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronRightIcon } from "./icons";

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

export function Breadcrumbs({ items }: Readonly<{ items: readonly BreadcrumbItem[] }>) {
  return (
    <nav aria-label="Drobečková navigace">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm text-ink-3">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li className="flex items-center gap-1" key={item.href ?? item.label}>
              {item.href && !last ? (
                <Link
                  className="rounded px-1 py-1 font-medium text-ink-2 underline-offset-4 hover:text-accent-strong hover:underline"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="px-1 py-1 text-ink-3">
                  {item.label}
                </span>
              )}
              {last ? null : <ChevronRightIcon className="text-line-strong" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PageHeaderProps {
  readonly title: ReactNode;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}

/** One header per screen: location, title and optional screen-level actions. */
export function PageHeader({ title, breadcrumbs, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 grid gap-2">
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="max-w-[65ch] text-ink-2">{description}</p> : null}
    </header>
  );
}
