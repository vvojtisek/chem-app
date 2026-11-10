import Link from "next/link";

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import workspace from "@/components/subject-workspace.module.css";
import { cn } from "@/lib/class-names";
import styles from "./practice.module.css";
import { type MathArea, mathAreaPath } from "./routes";

const INTRO: Readonly<Record<MathArea, string>> = {
  learn:
    "Vyberte okruh. Každý obsahuje výklad a řešič, který vlastní příklad spočítá krok za krokem.",
  practice:
    "Každý okruh obsahuje úlohy s nápovědou, kontrolou odpovědi a postupem řešení krok za krokem.",
};

/** The nine syllabus sections as tiles in the subject workspace panel. */
export function MathSectionCatalog({
  topics,
  area,
}: Readonly<{ topics: readonly MathTopic[]; area: MathArea }>) {
  return (
    <section aria-labelledby="math-sections-title" className={workspace.workspace}>
      <h2 className={styles.sectionHeading} id="math-sections-title">
        Tematické okruhy
      </h2>
      <p className={workspace.hint}>{INTRO[area]}</p>
      <ul className={styles.sectionGrid}>
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link className={styles.sectionTile} href={mathAreaPath(area, topic.id)}>
              <span className={styles.sectionNumber}>Okruh {topic.number}</span>
              <span className={styles.sectionTitle}>{topic.title}</span>
              <span className={styles.sectionDescription}>{topic.description}</span>
              <span className={cn(styles.sectionMeta)}>
                {area === "learn"
                  ? `Výklad${topic.solverTypes.length > 0 ? " · řešič" : ""}`
                  : `${topic.exercises.length} úloh`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
