import type { ReactNode } from "react";

/**
 * The start action of an exercise setup, kept in view while the learner scrolls through the
 * selection. Below 768 px it sits above the bottom tab bar (3.5 rem plus its border).
 */
export function SetupStartBar({
  summary,
  children,
}: Readonly<{ summary?: ReactNode; children: ReactNode }>) {
  return (
    <div
      className="sticky bottom-[calc(3.5rem_+_1px_+_env(safe-area-inset-bottom,0px))] z-10 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-sm backdrop-blur md:bottom-3"
      data-setup-start-bar=""
    >
      {summary ? <p className="m-0 min-w-0 text-sm text-ink-2">{summary}</p> : <span />}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
