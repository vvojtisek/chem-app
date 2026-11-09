"use client";

import "katex/dist/katex.min.css";
import katex from "katex";
import { useMemo } from "react";
import { cn } from "@/lib/class-names";

/**
 * Renders server-produced LaTeX with KaTeX. Output includes MathML, so screen
 * readers get the formula; `label` adds a plain-text equivalent when useful.
 * KaTeX runs with `trust: false`, so commands such as \href or \includegraphics
 * are refused even if they ever appeared in the input.
 */
export function MathTex({
  latex,
  display = false,
  className,
}: Readonly<{ latex: string; display?: boolean; className?: string }>) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        trust: false,
        strict: "ignore",
        output: "htmlAndMathml",
        maxSize: 20,
        maxExpand: 200,
      }),
    [latex, display],
  );
  return (
    <span
      className={cn("math-tex", display && "block overflow-x-auto py-1", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX escapes its input and runs with trust disabled; the LaTeX comes from the server's SymPy printer.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
