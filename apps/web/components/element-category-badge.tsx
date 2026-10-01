import { classifyElementCategory, type ElementCategoryInput } from "@inorganic/chemistry";

import categoryStyles from "@/components/element-category.module.css";
import { cn } from "@/lib/class-names";
import { ELEMENT_CATEGORY_LABELS } from "@/lib/element-categories";

/**
 * The element's category as a colour swatch with its name, so the category never depends on
 * colour alone. Use it only where the category cannot give away an answer still to be given.
 */
export function ElementCategoryBadge({
  element,
  className,
}: Readonly<{ element: ElementCategoryInput; className?: string | undefined }>) {
  const category = classifyElementCategory(element);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2", className)}
      data-element-category={category}
    >
      <span aria-hidden="true" className={categoryStyles.swatch} />
      <span>
        <span className="sr-only">Kategorie: </span>
        {ELEMENT_CATEGORY_LABELS[category]}
      </span>
    </span>
  );
}
