import type { MathTopic } from "@inorganic/content/higher-mathematics";
import { MathTex } from "@/components/math-tex";
import workspace from "@/components/subject-workspace.module.css";
import { MathText } from "./math-text";
import styles from "./practice.module.css";

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
    </section>
  );
}
