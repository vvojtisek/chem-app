import Link from "next/link";

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import workspace from "@/components/subject-workspace.module.css";
import { cn } from "@/lib/class-names";
import styles from "./practice.module.css";
import { mathSectionPath } from "./routes";

/** The nine syllabus sections as tiles in the subject workspace panel. */
export function MathPracticeCatalog({ topics }: Readonly<{ topics: readonly MathTopic[] }>) {
  return (
    <section aria-labelledby="math-sections-title" className={workspace.workspace}>
      <h2 className={styles.sectionHeading} id="math-sections-title">
        Tematické okruhy
      </h2>
      <p className={workspace.hint}>
        Každý okruh začíná výkladem a pokračuje úlohami s nápovědou, kontrolou odpovědi a postupem
        řešení. Odpovědi se vyhodnocují přímo v prohlížeči, takže okruhy fungují i v režimu hosta.
      </p>
      <ul className={styles.sectionGrid}>
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link className={styles.sectionTile} href={mathSectionPath(topic.id)}>
              <span className={styles.sectionNumber}>Okruh {topic.number}</span>
              <span className={styles.sectionTitle}>{topic.title}</span>
              <span className={styles.sectionDescription}>{topic.description}</span>
              <span className={cn(styles.sectionMeta)}>
                {topic.theory.length > 0 ? "Výklad · " : ""}
                {topic.exercises.length} úloh
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
