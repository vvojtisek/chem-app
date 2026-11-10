import katex from "katex";
import type { ReactNode } from "react";

/** Renders authored inline `$...$` expressions as accessible KaTeX MathML. */
export function MathText({
  children,
  display = false,
}: Readonly<{ children: string; display?: boolean }>) {
  const parts = children.split(/(\$[^$]+\$)/g);
  const occurrences = new Map<string, number>();
  return (
    <>
      {parts.map((part): ReactNode => {
        if (part.startsWith("$") && part.endsWith("$")) {
          const tex = part.slice(1, -1);
          const html = katex.renderToString(display ? `\\displaystyle ${tex}` : tex, {
            output: "htmlAndMathml",
            throwOnError: false,
            strict: "ignore",
          });
          const occurrence = occurrences.get(part) ?? 0;
          occurrences.set(part, occurrence + 1);
          return (
            // The TeX strings come from the checked-in, typed curriculum dataset.
            <span
              className="whitespace-nowrap"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX renders trusted static curriculum expressions.
              dangerouslySetInnerHTML={{ __html: html }}
              key={`${part}-${occurrence}`}
            />
          );
        }
        return part;
      })}
    </>
  );
}
