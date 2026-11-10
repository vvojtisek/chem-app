import Link from "next/link";

import type { MathTopic } from "@inorganic/content/higher-mathematics";
import { cn } from "@/lib/class-names";
import styles from "./practice.module.css";
import { mathSectionPath } from "./routes";

/** Section switcher, the same tile row as the problem types in Učivo. */
export function MathSectionNav({
  topics,
  currentId,
}: Readonly<{ topics: readonly MathTopic[]; currentId: string }>) {
  return (
    <nav aria-label="Okruhy">
      <ul className={styles.navList}>
        {topics.map((topic) => {
          const active = topic.id === currentId;
          return (
            <li key={topic.id}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(styles.navTile, active && styles.navTileActive)}
                href={mathSectionPath(topic.id)}
              >
                <span>{topic.number}.</span>
                <span>{topic.shortTitle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
