import Link from "next/link";

import { practiceCategories } from "@/lib/practice-catalog";

export function PracticeCategoryList() {
  return (
    <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2">
      {practiceCategories.map((category, index) => (
        <li
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgb(15_23_42/0.06)]"
          key={category.title}
        >
          <span aria-hidden="true" className="text-sm font-semibold text-emerald-700">
            0{index + 1}
          </span>
          <h3 className="mt-6 text-xl font-semibold text-slate-950">{category.title}</h3>
          <p className="mt-2 leading-7 text-slate-600">{category.description}</p>
          {category.links.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {category.links.map((link, linkIndex) => (
                <Link
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 font-semibold ${
                    linkIndex === 0
                      ? "bg-slate-950 text-white"
                      : "border border-slate-300 text-slate-900"
                  }`}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm font-medium text-slate-500">Připravujeme obsah</p>
          )}
        </li>
      ))}
    </ul>
  );
}
