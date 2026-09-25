import type { ElementGroupData } from "@inorganic/content/runtime";

export function GroupMnemonics({ group }: Readonly<{ group: ElementGroupData }>) {
  return (
    <div className="mt-2 leading-6 text-ink-2">
      <p>
        Mnemotechnická pomůcka: <strong>{group.mnemonicCs}</strong>
      </p>
      {group.alternativeMnemonic ? (
        <details className="mt-2 rounded-lg border border-line bg-surface px-3 py-2">
          <summary className="min-h-10 cursor-pointer font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Alternativní pomůcka: {group.alternativeMnemonic.traditionalLabelCs}
          </summary>
          <p className="mt-2 font-semibold">{group.alternativeMnemonic.mnemonicCs}</p>
          <p className="mt-1 text-sm">{group.alternativeMnemonic.explanationCs}</p>
          <p className="mt-2 text-xs text-ink-3">Pomůcka dodaná vlastníkem obsahu.</p>
        </details>
      ) : null}
    </div>
  );
}
