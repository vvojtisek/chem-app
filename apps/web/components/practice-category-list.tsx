import Link from "next/link";

import { practiceCategories } from "@/lib/practice-catalog";

export function PracticeCategoryList() {
  return (
    <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {practiceCategories.map((category, index) => (
        <li
          className="rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_32px_rgb(15_23_42/0.05)] sm:p-5"
          key={category.title}
        >
          <span aria-hidden="true" className="text-sm font-semibold text-good">
            0{index + 1}
          </span>
          <h3 className="mt-2 text-lg font-semibold text-ink">{category.title}</h3>
          <p className="mt-1 leading-6 text-ink-2">{category.description}</p>
          {category.links.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {category.links.map((link, linkIndex) => (
                <Link
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 font-semibold ${
                    linkIndex === 0
                      ? "bg-accent text-on-fill"
                      : "border border-line-strong text-ink"
                  }`}
                  href={link.href}
                  key={link.href}
                  rel={link.target === "_blank" ? "noreferrer" : undefined}
                  target={link.target}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm font-medium text-ink-3">Připravujeme obsah</p>
          )}
        </li>
      ))}
    </ul>
  );
}
