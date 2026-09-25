/** Singular, 2–4 and genitive plural forms, for example „odpověď“, „odpovědi“, „odpovědí“. */
export type CzechForms = readonly [one: string, few: string, many: string];

/** „1 odpověď“, „3 odpovědi“, „5 odpovědí“, also for 0. */
export function czechCount(count: number, forms: CzechForms): string {
  if (count === 1) return `${count} ${forms[0]}`;
  if (count >= 2 && count <= 4) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}

const percentFormat = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });

/** Share of correct answers in Czech notation, „80,3 %“; null when there are no answers. */
export function formatAccuracy(correct: number, total: number): string | null {
  if (total === 0) return null;
  return formatPercent((100 * correct) / total);
}

export function formatPercent(value: number): string {
  return `${percentFormat.format(Math.round(value * 10) / 10)} %`;
}
