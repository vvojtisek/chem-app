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

/**
 * Plain text with inline `$...$` TeX, as the server writes step
 * justifications. Text outside the dollars is rendered as text, never HTML.
 */
export function TextWithTex({ text }: Readonly<{ text: string }>) {
  const parts = text.split(/(\$[^$]+\$)/g);
  const seen = new Map<string, number>();
  return (
    <>
      {parts.map((part) => {
        const count = seen.get(part) ?? 0;
        seen.set(part, count + 1);
        const key = `${part}-${count}`;
        return part.length > 2 && part.startsWith("$") && part.endsWith("$") ? (
          <MathTex key={key} latex={part.slice(1, -1)} />
        ) : (
          <span key={key}>{part}</span>
        );
      })}
    </>
  );
}
