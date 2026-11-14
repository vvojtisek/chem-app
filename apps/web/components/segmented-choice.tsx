/** A row of mutually exclusive options, rendered as radio buttons styled as a segmented control. */
export function SegmentedChoice<Value extends string | number | null>({
  legend,
  name,
  options,
  value,
  onSelect,
}: Readonly<{
  legend: string;
  name: string;
  options: readonly { readonly value: Value; readonly label: string }[];
  value: Value;
  onSelect: (value: Value) => void;
}>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-2">{legend}</legend>
      <div className="inline-flex flex-wrap rounded-xl border border-line-strong bg-surface-3 p-1">
        {options.map((option) => (
          <label key={String(option.value)}>
            <input
              checked={value === option.value}
              className="peer sr-only"
              name={name}
              onChange={() => onSelect(option.value)}
              type="radio"
              value={String(option.value)}
            />
            <span className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-4 text-sm font-semibold text-ink-2 peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
              {value === option.value ? <span aria-hidden="true">✓</span> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
