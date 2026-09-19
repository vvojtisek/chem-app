"use client";

import type { ElementFlashcardData, ElementGroupData } from "@inorganic/content/runtime";
import { useEffect, useMemo, useState } from "react";

import {
  createBrowserElementCardStore,
  type StoredElementCard,
} from "@/lib/browser-element-card-store";

type EditableCard = Omit<StoredElementCard, "kind" | "updatedAt">;

interface ElementFlashcardsProps {
  readonly curatedElements: readonly ElementFlashcardData[];
  readonly groups: readonly ElementGroupData[];
}

export function ElementFlashcards({ curatedElements, groups }: ElementFlashcardsProps) {
  const [storedCards, setStoredCards] = useState<readonly StoredElementCard[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedId, setSelectedId] = useState(curatedElements[0]?.id ?? "");
  const [isFlipped, setIsFlipped] = useState(false);
  const [editor, setEditor] = useState<EditableCard | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void createBrowserElementCardStore().list().then(setStoredCards);
  }, []);

  const cards = useMemo(
    () => mergeCards(curatedElements, storedCards),
    [curatedElements, storedCards],
  );
  const visibleCards = useMemo(
    () =>
      selectedGroup === "all"
        ? cards
        : cards.filter((card) => card.group === Number(selectedGroup)),
    [cards, selectedGroup],
  );
  const selectedCard =
    visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0] ?? cards[0] ?? null;
  const selectedGroupInfo = selectedCard
    ? groups.find((group) => group.groupNumber === selectedCard.group)
    : undefined;

  function selectGroup(value: string) {
    setSelectedGroup(value);
    setSelectedId("");
    setIsFlipped(false);
  }

  async function saveCard(card: EditableCard, isCustom: boolean) {
    try {
      const stored: StoredElementCard = {
        ...card,
        kind: isCustom ? "custom" : "override",
        updatedAt: new Date().toISOString(),
      };
      await createBrowserElementCardStore().upsert(stored);
      setStoredCards(await createBrowserElementCardStore().list());
      setSelectedId(card.id);
      setEditor(null);
      setMessage(
        isCustom
          ? "Vlastní karta byla uložena pouze do tohoto zařízení."
          : "Lokální úprava byla uložena.",
      );
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? `Lokální úpravu se nepodařilo uložit: ${error.message}`
          : "Lokální úpravu se nepodařilo uložit.",
      );
    }
  }

  async function resetCard() {
    if (!selectedCard || !curatedElements.some((card) => card.id === selectedCard.id)) {
      return;
    }
    await createBrowserElementCardStore().remove(selectedCard.id);
    setStoredCards(await createBrowserElementCardStore().list());
    setMessage("Výchozí schválená karta byla obnovena.");
  }

  if (!selectedCard) {
    return <p role="status">K dispozici zatím nejsou žádné karty.</p>;
  }

  return (
    <section aria-labelledby="flashcard-heading" className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-emerald-800 uppercase">
            Flashcards
          </p>
          <h1
            id="flashcard-heading"
            className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
          >
            Prvky
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Česká jména, značky a základní údaje. Vaše úpravy zůstávají lokálně v tomto zařízení.
          </p>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-800">
          Skupina
          <select
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"
            onChange={(event) => selectGroup(event.target.value)}
            value={selectedGroup}
          >
            <option value="all">Všechny prvky ({cards.length})</option>
            {groups.map((group) => (
              <option key={group.groupNumber} value={group.groupNumber}>
                {group.groupNumber}. skupina — {group.nameCs}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgb(15_23_42/0.06)] sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">
            {selectedCard.atomicNumber}. prvek
          </span>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Vybraná karta
            <select
              aria-label="Vybraná karta"
              className="min-h-11 max-w-52 rounded-xl border border-slate-300 bg-white px-3"
              onChange={(event) => {
                setSelectedId(event.target.value);
                setIsFlipped(false);
              }}
              value={selectedCard.id}
            >
              {visibleCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.symbol} — {card.nameCs}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-12 text-center" aria-live="polite">
          {isFlipped ? (
            <>
              <h2 className="text-3xl font-semibold text-slate-950">{selectedCard.nameCs}</h2>
              <p className="mt-2 text-lg text-slate-600">{selectedCard.nameLat}</p>
              <dl className="mx-auto mt-8 grid max-w-xl gap-4 text-left sm:grid-cols-2">
                <Fact label="Perioda" value={String(selectedCard.period)} />
                <Fact
                  label="Skupina"
                  value={selectedCard.group ? String(selectedCard.group) : "f-blok"}
                />
                <Fact
                  label="Relativní atomová hmotnost"
                  value={String(selectedCard.atomicWeight)}
                />
                <Fact label="Valenční konfigurace" value={selectedCard.valenceConfiguration} />
              </dl>
            </>
          ) : (
            <>
              <p className="text-lg text-slate-600">Jak se tento prvek nazývá česky?</p>
              <p className="mt-6 text-7xl font-semibold tracking-tight text-slate-950 sm:text-8xl">
                {selectedCard.symbol}
              </p>
            </>
          )}
        </div>

        {selectedGroupInfo ? (
          <aside className="mt-10 rounded-2xl border border-emerald-900/15 bg-emerald-50 p-5 text-left">
            <h3 className="font-semibold text-slate-950">{selectedGroupInfo.nameCs}</h3>
            <p className="mt-2 leading-7 text-slate-700">
              Mnemotechnika: {selectedGroupInfo.mnemonicCs}
            </p>
          </aside>
        ) : null}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button
            className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
            onClick={() => setIsFlipped((value) => !value)}
            type="button"
          >
            {isFlipped ? "Zobrazit značku" : "Otočit kartu"}
          </button>
          <button
            className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
            onClick={() => setEditor(toEditableCard(selectedCard))}
            type="button"
          >
            Upravit kartu
          </button>
          {curatedElements.some((card) => card.id === selectedCard.id) ? (
            <button
              className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
              onClick={() => void resetCard()}
              type="button"
            >
              Obnovit výchozí
            </button>
          ) : null}
          <button
            className="min-h-11 rounded-xl border border-emerald-700 px-4 font-semibold text-emerald-900"
            onClick={() => setEditor(createCustomCard(cards))}
            type="button"
          >
            Přidat vlastní prvek
          </button>
        </div>
        {message ? (
          <p className="mt-5 text-center text-sm text-slate-700" role="status">
            {message}
          </p>
        ) : null}
      </div>

      {editor ? (
        <ElementEditor
          card={editor}
          isCustom={!curatedElements.some((item) => item.id === editor.id)}
          onCancel={() => setEditor(null)}
          onSave={saveCard}
        />
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ElementEditor({
  card,
  isCustom,
  onCancel,
  onSave,
}: {
  readonly card: EditableCard;
  readonly isCustom: boolean;
  readonly onCancel: () => void;
  readonly onSave: (card: EditableCard, isCustom: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState(card);
  const [error, setError] = useState("");
  function update<Key extends keyof EditableCard>(key: Key, value: EditableCard[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.nameCs.trim() || !draft.symbol.match(/^[A-Z][a-z]?$/u) || !draft.nameLat.trim()) {
      setError("Vyplňte český i latinský název a platnou značku.");
      return;
    }
    await onSave(
      {
        ...draft,
        nameCs: draft.nameCs.trim(),
        nameLat: draft.nameLat.trim(),
        symbol: draft.symbol.trim(),
        valenceConfiguration: draft.valenceConfiguration.trim(),
      },
      isCustom,
    );
  }
  return (
    <form
      aria-label="Editor karty prvku"
      className="mt-8 rounded-3xl border border-slate-200 bg-white p-6"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <h2 className="text-2xl font-semibold text-slate-950">
        {isCustom ? "Nový vlastní prvek" : "Lokální úprava karty"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Úpravy nejsou publikací kurikula; uloží se jen do tohoto prohlížeče.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Český název"
          value={draft.nameCs}
          onChange={(value) => update("nameCs", value)}
        />
        <Field
          label="Latinský název"
          value={draft.nameLat}
          onChange={(value) => update("nameLat", value)}
        />
        <Field label="Značka" value={draft.symbol} onChange={(value) => update("symbol", value)} />
        <Field
          label="Protonové číslo"
          type="number"
          value={String(draft.atomicNumber)}
          onChange={(value) => update("atomicNumber", Number(value))}
        />
        <Field
          label="Perioda"
          type="number"
          value={String(draft.period)}
          onChange={(value) => update("period", Number(value))}
        />
        <Field
          label="Skupina (nechte prázdné pro f-blok)"
          type="number"
          value={draft.group ? String(draft.group) : ""}
          onChange={(value) => update("group", value ? Number(value) : null)}
        />
        <Field
          label="Relativní atomová hmotnost"
          type="number"
          value={String(draft.atomicWeight)}
          onChange={(value) => update("atomicWeight", Number(value))}
        />
        <Field
          label="Valenční konfigurace"
          value={draft.valenceConfiguration}
          onChange={(value) => update("valenceConfiguration", value)}
        />
      </div>
      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="min-h-11 rounded-xl bg-slate-950 px-4 font-semibold text-white"
          type="submit"
        >
          Uložit lokálně
        </button>
        <button
          className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-900"
          onClick={onCancel}
          type="button"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly type?: "number" | "text";
  readonly value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-800">
      {label}
      <input
        className="min-h-11 rounded-xl border border-slate-300 px-3"
        onChange={(event) => onChange(event.target.value)}
        required={label !== "Skupina (nechte prázdné pro f-blok)"}
        step={type === "number" ? "any" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function mergeCards(
  curated: readonly ElementFlashcardData[],
  stored: readonly StoredElementCard[],
): readonly EditableCard[] {
  const cards = new Map(curated.map((card) => [card.id, card]));
  for (const card of stored) {
    if (card.kind === "custom" || cards.has(card.id)) cards.set(card.id, toEditableCard(card));
  }
  return [...cards.values()].sort(
    (left, right) => left.atomicNumber - right.atomicNumber || left.id.localeCompare(right.id),
  );
}
function toEditableCard(card: ElementFlashcardData | StoredElementCard): EditableCard {
  const { kind: _kind, updatedAt: _updatedAt, ...editable } = card as StoredElementCard;
  return editable;
}
function createCustomCard(cards: readonly EditableCard[]): EditableCard {
  return {
    id: `custom.${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
    atomicNumber: Math.min(118, Math.max(1, (cards.at(-1)?.atomicNumber ?? 0) + 1)),
    symbol: "X",
    nameCs: "",
    nameLat: "",
    period: 7,
    group: null,
    atomicWeight: 1,
    valenceConfiguration: "",
  };
}
