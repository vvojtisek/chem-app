/** Joins the class names that are set, for conditional Tailwind classes. */
export function cn(...classNames: readonly (string | false | null | undefined)[]): string {
  return classNames.filter(Boolean).join(" ");
}
