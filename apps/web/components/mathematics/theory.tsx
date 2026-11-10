import Link from "next/link";

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import { MathTex } from "@/components/math-tex";
import workspace from "@/components/subject-workspace.module.css";
import { MathText } from "./math-text";
import styles from "./practice.module.css";
import { MATH_SOLVER_LABELS, mathSolverPath } from "./routes";

/** Section theory: authored text with inline and display TeX. */
export function MathTheory({ topic }: Readonly<{ topic: MathTopic }>) {
  if (topic.theory.length === 0) return null;
  return (
    <section aria-labelledby="math-theory-title" className={styles.theory}>
      <h2 className={styles.sectionHeading} id="math-theory-title">
        Výklad
      </h2>
      {topic.theory.map((block) => (
        <article className={workspace.card} key={block.heading}>
          <h3 className={workspace.cardTitle}>{block.heading}</h3>
          <div className={styles.prose}>
            {block.paragraphs.map((paragraph) => (
              <p key={paragraph}>
                <MathText>{paragraph}</MathText>
              </p>
            ))}
            {block.formulas?.map((formula) => (
              // A long formula scrolls horizontally on phones; the region is
              // focusable so keyboard users can scroll it too (WCAG 2.1.1).
              // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable.
              <figure aria-label="Vzorec" className={styles.formula} key={formula} tabIndex={0}>
                <MathTex latex={`\\displaystyle ${formula}`} />
              </figure>
            ))}
            {block.items && block.items.length > 0 ? (
              <ul>
                {block.items.map((item) => (
                  <li key={item}>
                    <MathText>{item}</MathText>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>
      ))}
      {topic.solverTypes.length > 0 ? (
        <aside aria-label="Vlastní příklad" className={workspace.card}>
          <h3 className={workspace.cardTitle}>Vlastní příklad krok za krokem</h3>
          <p className={workspace.hint}>
            Řešič v učivu spočítá libovolné zadání a ukáže použitá pravidla (jen pro přihlášené,
            potřebuje připojení).
          </p>
          <div className={workspace.actions}>
            {topic.solverTypes.map((type) => (
              <Link className={styles.linkButton} href={mathSolverPath(type)} key={type}>
                {MATH_SOLVER_LABELS[type]}
              </Link>
            ))}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
