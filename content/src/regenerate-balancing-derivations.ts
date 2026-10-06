import { readFileSync } from "node:fs";
import {
  type BalancingReactionLesson,
  balancingReactionCollectionSchema,
} from "./balancing-reactions-schema";
import { deriveLessonSteps, makeDerivationStep } from "./derive-balancing-lessons";

const sourceUrl =
  "https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions";
const input = readFileSync(new URL("../data/balancing-reactions.json", import.meta.url), "utf8");
const collection = balancingReactionCollectionSchema.parse(JSON.parse(input));
const elementData: unknown = JSON.parse(
  readFileSync(new URL("../data/elements.json", import.meta.url), "utf8"),
);
if (!Array.isArray(elementData)) throw new Error("Invalid element collection");
const symbols = new Set<string>(
  elementData.map((element: unknown) => {
    if (
      typeof element !== "object" ||
      element === null ||
      !("symbol" in element) ||
      typeof element.symbol !== "string"
    )
      throw new Error("Invalid element");
    return element.symbol;
  }),
);

function updateLesson(lesson: BalancingReactionLesson): BalancingReactionLesson {
  const final = lesson.steps.at(-1);
  if (!final) throw new Error("Missing final");
  const species = [...final.equation.reactants, ...final.equation.products];
  const split = final.equation.reactants.length;
  const steps = lesson.steps.map((s) => ({ ...s }));
  if (lesson.id === "reaction.balancing.cat-1-02") {
    const frame = (
      coefficients: number[],
      title: string,
      explanation: string,
      changes: number[] = [],
    ) => makeDerivationStep(species, split, coefficients, symbols, title, explanation, changes);
    const derived = [
      frame(
        [1, 1, 1, 1],
        "Nejprve fluor: volba prvku",
        "F je pouze v BF3 vlevo a H[BF4] vpravo, proto jej vyrovnáme bez změny vody. B je na pravé straně rozdělen; H je ve vodě i obou produktech. Výchozí počty: F 3 vs 4; B 1 vs 2; H 2 vs 4; O 1 vs 3.",
      ),
      frame(
        [4, 1, 3, 1],
        "Fluor: nejmenší společný násobek",
        "V BF3 jsou 3 F, v H[BF4] jsou 4 F. NSN(3, 4) = 12. Proto 12 / 3 = 4 před BF3 a současně 12 / 4 = 3 před H[BF4]: 4 × 3 = 3 × 4 = 12 F. Oba koeficienty vyplývají z jedné bilance.",
        [0, 2],
      ),
      frame(
        [4, 1, 3, 1],
        "Bor: chybějící atom",
        "Po F vyrovnáme rozdělený B: vlevo 4 × 1 = 4 B; vpravo H[BF4] již dává 3 × 1 = 3 B. Chybí 4 − 3 = 1 B, tedy (4 − 3) / 1 = 1 před H3BO3. Koeficient 1 je nyní odvozen, ne výchozí odhad.",
        [3],
      ),
      frame(
        [4, 3, 3, 1],
        "Voda uzavírá H a O",
        "Vodu necháme poslední. Vpravo O: 1 × 3 = 3; H: 3 × 1 + 1 × 3 = 6. H2O má 1 O a 2 H, proto z O: 3 / 1 = 3 vody; z H: 6 / 2 = 3 vody. Shodný výsledek uzavírá obě bilance.",
        [1],
      ),
      {
        ...frame(
          [4, 3, 3, 1],
          "Závěrečné shrnutí",
          "B: 4 = 3 + 1 = 4; F: 4 × 3 = 3 × 4 = 12; H: 3 × 2 = 3 + 3 = 6; O: 3 × 1 = 1 × 3 = 3. Zákon zachování hmotnosti je splněn; poměr 4 : 3 : 3 : 1 nelze krátit.",
        ),
        kind: "summary" as const,
      },
    ];
    return { ...lesson, steps: derived.map((s, i) => ({ ...s, stepIndex: i + 1 })) };
  }
  if (lesson.id === "reaction.balancing.boric-acid") {
    const explanations = [
      "Při koeficientech 1: Na 2 vs 1; B 4 vs 1; O 8 vs 3; H 3 = 3; Cl 1 = 1. Nejprve B/Na, každý je v jedné látce na obou stranách; H/O a vodu ponecháme poslední.",
      "Koeficient mění počet částic, ne jejich složení: 2 H2O mají 2 × 2 = 4 H a 2 × 1 = 2 O. Indexy neměňte. V dalších krocích odvodíme B, Na, Cl a teprve pak H/O.",
      "B má přednost: je pouze v Na2B4O7 vlevo a H3BO3 vpravo. NSN(4, 1) = 4: 4 / 4 = 1 borax, 4 / 1 = 4 kyseliny. Bilance B: 1 × 4 = 4 × 1 = 4.",
      "Na je také v jedné látce na každé straně. Vlevo 1 × 2 = 2 Na; NaCl má 1 Na. Proto 2 / 1 = 2 před NaCl: 1 × 2 = 2 × 1. Bor přitom neměníme.",
      "Cl nyní závisí na odvozených 2 NaCl: vpravo 2 × 1 = 2 Cl. HCl má 1 Cl, tedy 2 / 1 = 2 před HCl. Vlevo dodá také 2 × 1 = 2 H; vodu ještě ponecháme.",
      "Voda je poslední. H vpravo: 4 × 3 = 12; HCl vlevo dodá 2. Chybí 12 − 2 = 10 H; H2O má 2 H, tedy 10 / 2 = 5 vod. Kontrola O: 7 + 5 × 1 = 4 × 3 = 12.",
      "Na: 2 = 2; B: 4 = 4; Cl: 2 = 2; H: 2 + 5 × 2 = 4 × 3 = 12; O: 7 + 5 = 4 × 3 = 12. Poměr 1 : 2 : 5 : 4 : 2 je nejmenší a zachovává hmotnost.",
    ];
    return {
      ...lesson,
      steps: steps.map((s, i) => ({ ...s, explanation: explanations[i] ?? s.explanation })),
    };
  }
  if (lesson.id === "reaction.balancing.cat-1-06") {
    const descriptions = [
      "Při koeficientech 1: As 2 = 2, S 3 = 3; O 1 vs 4, H 1 vs 2, náboj −1 vs −6. Nejdříve As/S, protože určují poměr obou produktů; H/O a vodu necháme poslední.",
      "S je v jedné látce vlevo i vpravo: 3 / 3 = 1 AsS3^3-. As pak vyžaduje 2 − 1 = 1 AsO3^3-. Náboj produktů je −3 −3 = −6; OH^- má −1, proto musí x splňovat −x = −6. Náboj řešíme současně s H/O.",
      "Označme OH^- jako x a vodu jako y. Z O: vlevo x × 1, vpravo 1 × 3 + y × 1, tedy x = 3 + y. Náboj již požaduje x = 6; souhlas ověříme také z H.",
      "H dává x = 2y. S O: 2y = 3 + y → y = 3 a x = 6. Náboj: −6 = −3 −3. Zapíšeme 6 OH^-; počet 3 H2O je odvozen, ale vodu doplníme až jako poslední.",
      "Vodu doplníme poslední: z H je 6 / 2 = 3 H2O, z O je (6 − 3) / 1 = 3 H2O. Obě nezávislé bilance dávají 3. Náboj: 6 × (−1) = −3 −3 = −6.",
      "As: 2 = 1 + 1; S: 3 = 3; O: 6 = 3 + 3; H: 6 = 3 × 2; náboj: −6 = −3 −3. Hmotnost i náboj jsou zachovány, poměr 1 : 6 : 1 : 1 : 3 nelze krátit.",
    ];
    const coefficients = [
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 6, 1, 1, 1],
      [1, 6, 1, 1, 3],
      [1, 6, 1, 1, 3],
    ];
    return {
      ...lesson,
      steps: steps.map((s, i) => ({
        ...s,
        ...makeDerivationStep(
          species,
          split,
          coefficients[i] ?? [],
          symbols,
          s.title,
          descriptions[i] ?? s.explanation,
          i === 3 ? [1] : i === 4 ? [4] : [],
        ),
        stepIndex: i + 1,
      })),
    };
  }
  if (lesson.id === "reaction.balancing.iodine-synproportionation") {
    const frames = [
      [1, 1, 1, 1, 1],
      [1, 1, 6, 1, 1],
      [1, 5, 6, 1, 1],
      [1, 5, 6, 3, 1],
      [1, 5, 6, 3, 3],
    ];
    const text = [
      "I je rozdělen mezi IO3^- a I^-, proto jeho koeficient zatím neurčí samotné počítání. O v IO3^- dává pro vodu y = 3 / 1 = 3. To je vztah pro další výpočet; vodu zatím nezapisujeme, nejprve určíme H a náboj.",
      "Z odvozeného y = 3 vychází H: x × 1 = 3 × 2 = 6, tedy x = 6 H^+. Náboj vlevo: −1 −1 +6 = +4; produkty jsou neutrální, takže náboj musí určit počet I^-.",
      "Náboj je primární podmínka: −1 − z +6 = 0 → z = 6 −1 = 5 I^-. Vlevo je nyní 1 +5 = 6 I; tento počet určí I2, ne odhad koeficientu.",
      "Z náboje odvozených 5 I^- dává I vlevo 1 +5 = 6. I2 má 2 I: 6 / 2 = 3 I2. Hmotnostní i nábojová bilance nyní určují vodu jednoznačně.",
      "Vodu zapíšeme poslední: z O je 3 / 1 = 3 H2O; z H je 6 / 2 = 3 H2O. Kontrola I: 1 +5 = 3 × 2 = 6; náboj: −1 −5 +6 = 0.",
    ];
    for (let i = 0; i < 5; i++) {
      const old = steps[i + 3];
      if (!old) throw new Error("Missing iodine slide");
      steps[i + 3] = {
        ...old,
        ...makeDerivationStep(
          species,
          split,
          frames[i] ?? [],
          symbols,
          i === 0
            ? "Odvoďte vodu, zatím ji nezapisujte"
            : i === 4
              ? "Voda uzavírá bilanci"
              : old.title,
          text[i] ?? "",
          i === 0 ? [] : i === 1 ? [2] : i === 2 ? [1] : i === 3 ? [3] : [4],
        ),
        stepIndex: i + 4,
      };
    }
    return { ...lesson, steps };
  }
  const peroxide = species.findIndex((s) => s.formula === "H2O2");
  const oxygen = species.findIndex((s) => s.formula === "O2");
  const enriched =
    peroxide >= 0 && oxygen >= 0
      ? {
          ...lesson,
          derivationConstraints: [
            {
              label: "Peroxid → kyslík",
              values: species.map((_, i) => (i === peroxide ? 1 : i === oxygen ? -1 : 0)),
              explanation:
                "Samotné atomy a náboj neurčují tuto kostru jednoznačně. Použijeme oxidační půlrovnici H2O2 → O2 + 2 H^+ + 2 e^-: O 2 = 2, H 2 = 2, náboj 0 = +2 −2. Proto 1 peroxid vytváří 1 O2 a jejich koeficienty jsou stejné. Jde o explicitní redoxový model, ne důsledek samotné atomové bilance.",
            },
          ],
          sources: lesson.sources.some((s) => s.locator === sourceUrl)
            ? lesson.sources
            : [
                ...lesson.sources,
                {
                  title: "OpenStax Chemistry 2e: conservation and peroxide oxidation",
                  locator: sourceUrl,
                },
              ],
        }
      : lesson;
  return { ...enriched, steps: deriveLessonSteps(enriched, symbols) };
}

const index = Number(process.argv[2]);
const lesson = collection.lessons[index];
if (!Number.isInteger(index) || !lesson)
  throw new Error(
    "Pass an existing lesson index; stdout emits an apply_patch update, not a file write",
  );
const updated = updateLesson(lesson);
const start = input.indexOf(`    {\n      "id": "${lesson.id}"`);
const next = collection.lessons[index + 1];
const end = next ? input.indexOf(`    {\n      "id": "${next.id}"`) : input.lastIndexOf("  ]");
if (start < 0 || end < start) throw new Error("Cannot locate exact lesson block");
const old = input.slice(start, end).trimEnd();
const replacement =
  JSON.stringify(updated, null, 2)
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n") + (next ? "," : "");
process.stdout.write(
  `*** Begin Patch\n*** Update File: content/data/balancing-reactions.json\n@@\n${old
    .split("\n")
    .map((l) => `-${l}`)
    .join("\n")}\n${replacement
    .split("\n")
    .map((l) => `+${l}`)
    .join("\n")}\n*** End Patch\n`,
);
